import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type RAPIER from '@dimforge/rapier2d-compat';
import roverSvgUrl from '../data/Rover.svg?url';
import {
  ROVER_WIDTH,
  ROVER_HEIGHT,
  PIXELS_PER_METER,
} from './constants';
import { tuning } from './tuning';
import { rapier, type RoverBody } from './physics';
import type { InputState } from './input';

export const ROVER_WHEEL_OFFSETS = [-0.95, 0.95];
const WIREFRAME_COLOR = 0xffffff;
const ROVER_SVG_ASPECT = 600 / 347;
const WHEEL_MOUNT_Y = ROVER_HEIGHT * 0.2;
let roverTexture: Texture | null = null;

export async function loadRoverGraphics() {
  roverTexture = await Assets.load<Texture>(roverSvgUrl);
}

export interface Rover {
  container: Container;
  body: RoverBody;
  wheelRotation: number;
  wheelDriveInput: number;
  wheelTravel: number[];
  isGrounded: boolean;
  isRighting: boolean;
  terrainAngle: number;
  terrainDistance: number;
  roverBoosting: boolean;
}

export function createRoverGraphics(): Container {
  const container = new Container();
  drawRoverGraphics(container);
  return container;
}

export function drawRoverGraphics(container: Container) {
  container.removeChildren();
  const ppm = PIXELS_PER_METER;
  const hw = (ROVER_WIDTH / 2) * ppm;
  const hh = (ROVER_HEIGHT / 2) * ppm;
  const sprite = new Sprite(roverTexture ?? Texture.WHITE);
  sprite.anchor.set(0.5);
  sprite.height = hh * 2;
  sprite.width = sprite.height * ROVER_SVG_ASPECT;
  sprite.label = 'roverSprite';
  container.addChild(sprite);

  const debugCollider = new Graphics();
  debugCollider.rect(-hw, -hh, hw * 2, hh * 2);
  debugCollider.stroke({
    color: tuning.wireframe ? WIREFRAME_COLOR : 0xff3355,
    width: 2,
    alpha: 0.9,
  });
  debugCollider.label = 'debugColliderBounds';
  debugCollider.visible = false;
  container.addChild(debugCollider);
}

export function createRover(body: RoverBody): Rover {
  return {
    container: createRoverGraphics(),
    body,
    wheelRotation: 0,
    wheelDriveInput: 0,
    wheelTravel: ROVER_WHEEL_OFFSETS.map(() => 0),
    isGrounded: false,
    isRighting: false,
    terrainAngle: 0,
    terrainDistance: Infinity,
    roverBoosting: false,
  };
}

function localPoint(body: RAPIER.RigidBody, x: number, y: number) {
  const pos = body.translation();
  const rot = body.rotation();
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return {
    x: pos.x + cos * x - sin * y,
    y: pos.y + sin * x + cos * y,
  };
}

function localVector(body: RAPIER.RigidBody, x: number, y: number) {
  const rot = body.rotation();
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return {
    x: cos * x - sin * y,
    y: sin * x + cos * y,
  };
}

/**
 * Heavy ground-vehicle model — no thrusters. The chassis is a single rigid body
 * carried by two raycast "wheels" (a spring-damper strut each), so it follows
 * terrain and can launch off ramps when it's moving fast enough on its own
 * momentum. Left/right drive a motor whose pull tapers off near top speed; with
 * no input the wheels grip the slope (engine braking) so it holds still on
 * inclines. While airborne, left/right pitch the chassis for a clean landing.
 *
 * All tuning values below are forces in newtons (impulse = force * dt), except
 * the m/s "speed" cap and `roverGrip` (m/s^2 of braking deceleration).
 */
export function updateRoverPhysics(
  rover: Rover,
  input: InputState,
  dt: number,
  world: RAPIER.World,
) {
  const body = rover.body.rigidBody;
  const mass = body.mass();
  const driveInput = input.right - input.left;

  rover.roverBoosting = false;
  rover.isGrounded = false;

  let tangentX = 0;
  let tangentY = 0;
  let normalX = 0;
  let normalY = 0;
  let contactX = 0;
  let contactY = 0;
  let contacts = 0;
  let nearestGround = Infinity;

  for (let i = 0; i < ROVER_WHEEL_OFFSETS.length; i++) {
    const mount = localPoint(body, ROVER_WHEEL_OFFSETS[i], WHEEL_MOUNT_Y);
    const down = localVector(body, 0, 1);
    const ray = new rapier.Ray(mount, down);
    const hit = world.castRayAndGetNormal(
      ray,
      tuning.roverSuspensionLength,
      true,
      undefined,
      undefined,
      rover.body.collider,
    );

    if (!hit) {
      rover.wheelTravel[i] = tuning.roverSuspensionLength;
      continue;
    }

    const hitPoint = ray.pointAt(hit.timeOfImpact);
    const compression = tuning.roverSuspensionLength - hit.timeOfImpact;
    const wheelVelocity = body.velocityAtPoint(hitPoint);
    // Compression speed along the wheel ray — positive while the strut is
    // compressing (chassis moving down toward the ground). Damping must OPPOSE
    // that motion, so it ADDS to the upward force here (a minus sign would be
    // anti-damping and make the suspension oscillate forever).
    const compressionSpeed =
      wheelVelocity.x * down.x + wheelVelocity.y * down.y;
    const suspensionForce = Math.max(
      0,
      Math.min(
        tuning.roverSuspensionMaxForce,
        compression * tuning.roverSuspensionSpring +
          compressionSpeed * tuning.roverSuspensionDamping,
      ),
    );

    body.applyImpulseAtPoint(
      {
        x: -down.x * suspensionForce * dt,
        y: -down.y * suspensionForce * dt,
      },
      hitPoint,
      true,
    );

    // Surface tangent, oriented toward the rover's forward (right) direction.
    let tangent = { x: hit.normal.y, y: -hit.normal.x };
    const right = localVector(body, 1, 0);
    if (tangent.x * right.x + tangent.y * right.y < 0) {
      tangent = { x: -tangent.x, y: -tangent.y };
    }

    tangentX += tangent.x;
    tangentY += tangent.y;
    normalX += hit.normal.x;
    normalY += hit.normal.y;
    contactX += hitPoint.x;
    contactY += hitPoint.y;
    nearestGround = Math.min(nearestGround, hit.timeOfImpact);
    rover.wheelTravel[i] = hit.timeOfImpact;
    contacts++;
  }

  const vel = body.linvel();

  if (contacts > 0) {
    const inv = 1 / contacts;
    contactX *= inv;
    contactY *= inv;
    normalX *= inv;
    normalY *= inv;
    const tLen = Math.hypot(tangentX, tangentY) || 1;
    tangentX /= tLen;
    tangentY /= tLen;

    rover.isGrounded = true;
    rover.terrainAngle = Math.atan2(tangentY, tangentX);
    rover.terrainDistance = nearestGround;

    // Rolling velocity along the slope.
    const tangentialSpeed = vel.x * tangentX + vel.y * tangentY;

    if (driveInput !== 0) {
      // Motor pull along the slope, tapering to zero as we near top speed so
      // the rover settles at roverMaxSpeed under wheel power alone.
      const speedAlong = tangentialSpeed * Math.sign(driveInput);
      const speedFactor = Math.max(0, 1 - speedAlong / tuning.roverMaxSpeed);
      const drive = driveInput * tuning.roverAccel * speedFactor * dt;
      body.applyImpulseAtPoint(
        { x: tangentX * drive, y: tangentY * drive },
        { x: contactX, y: contactY },
        true,
      );
    } else {
      // Engine braking / grip: bleed off rolling speed (capped per step) so the
      // rover holds on inclines instead of sliding.
      const maxBrake = tuning.roverGrip * dt;
      const dv = Math.max(-maxBrake, Math.min(maxBrake, tangentialSpeed));
      body.applyImpulse(
        { x: -tangentX * dv * mass, y: -tangentY * dv * mass },
        true,
      );
    }

    // Press the chassis into the surface for traction over bumps.
    body.applyImpulse(
      {
        x: -normalX * tuning.roverDownforce * dt,
        y: -normalY * tuning.roverDownforce * dt,
      },
      true,
    );
  } else {
    rover.terrainDistance = Infinity;
    // Airborne: steer pitches the chassis to line up a landing.
    if (driveInput !== 0) {
      body.applyTorqueImpulse(driveInput * tuning.roverAirTorque * dt, true);
    }
  }

  // Absolute safety ceiling — momentum from launches can briefly exceed the
  // motor's top speed, but never let it run away.
  const hardCap = tuning.roverMaxSpeed * 2.5;
  const postVel = body.linvel();
  const speed = Math.hypot(postVel.x, postVel.y);
  if (speed > hardCap) {
    const scale = hardCap / speed;
    body.setLinvel({ x: postVel.x * scale, y: postVel.y * scale }, true);
  }

  rover.wheelDriveInput = Math.sign(postVel.x);
  rover.wheelRotation += postVel.x * tuning.roverWheelSpinSpeed * 0.08 * dt;
}

export function syncRoverGraphics(rover: Rover) {
  const pos = rover.body.rigidBody.translation();
  const rot = rover.body.rigidBody.rotation();
  const vel = rover.body.rigidBody.linvel();
  const ppm = PIXELS_PER_METER;
  rover.container.x = pos.x * ppm;
  rover.container.y = pos.y * ppm;
  rover.container.rotation = rot;
  if (Math.abs(vel.x) > 0.01) rover.wheelRotation += vel.x * 0.05;

  for (let i = 0; i < ROVER_WHEEL_OFFSETS.length; i++) {
    const wheel = rover.container.children.find((c) => c.label === `wheel${i}`);
    if (wheel) {
      wheel.y = ROVER_HEIGHT * 0.1 * ppm + rover.wheelTravel[i] * ppm;
      wheel.rotation = rover.wheelRotation;
    }
  }
}
