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
const DRIVE_FORCE_SPLIT = 1 / ROVER_WHEEL_OFFSETS.length;
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

export function updateRoverPhysics(
  rover: Rover,
  input: InputState,
  dt: number,
  world: RAPIER.World,
) {
  const body = rover.body.rigidBody;
  const driveInput = input.right - input.left;
  rover.roverBoosting = false;
  rover.isGrounded = false;

  let averageTangentX = 0;
  let averageTangentY = 0;
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
    const springVelocity = wheelVelocity.x * down.x + wheelVelocity.y * down.y;
    const suspensionForce = Math.max(
      0,
      Math.min(
        tuning.roverSuspensionMaxForce,
        compression * tuning.roverSuspensionSpring -
          springVelocity * tuning.roverSuspensionDamping,
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

    let tangent = { x: hit.normal.y, y: -hit.normal.x };
    const right = localVector(body, 1, 0);
    if (tangent.x * right.x + tangent.y * right.y < 0) {
      tangent = { x: -tangent.x, y: -tangent.y };
    }

    if (driveInput !== 0) {
      body.applyImpulseAtPoint(
        {
          x: tangent.x * driveInput * tuning.roverAccel * DRIVE_FORCE_SPLIT * dt,
          y: tangent.y * driveInput * tuning.roverAccel * DRIVE_FORCE_SPLIT * dt,
        },
        hitPoint,
        true,
      );
    }

    averageTangentX += tangent.x;
    averageTangentY += tangent.y;
    nearestGround = Math.min(nearestGround, hit.timeOfImpact);
    rover.wheelTravel[i] = hit.timeOfImpact;
    rover.isGrounded = true;
    contacts++;
  }

  if (contacts > 0) {
    rover.terrainAngle = Math.atan2(averageTangentY, averageTangentX);
    rover.terrainDistance = nearestGround;
    const down = localVector(body, 0, 1);
    body.applyImpulse(
      {
        x: down.x * tuning.roverDownforce * dt,
        y: down.y * tuning.roverDownforce * dt,
      },
      true,
    );
  } else {
    rover.terrainDistance = Infinity;
  }

  let vel = body.linvel();
  if (contacts > 0 && vel.y < 0) {
    body.setLinvel({ x: vel.x, y: vel.y * 0.35 }, true);
    vel = body.linvel();
  }
  const speed = Math.hypot(vel.x, vel.y);
  if (speed > tuning.roverMaxSpeed) {
    const scale = tuning.roverMaxSpeed / speed;
    body.setLinvel({ x: vel.x * scale, y: vel.y * scale }, true);
  }

  rover.wheelDriveInput = Math.sign(vel.x);
  rover.wheelRotation += vel.x * tuning.roverWheelSpinSpeed * 0.08 * dt;
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
