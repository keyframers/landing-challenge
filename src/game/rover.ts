import { Container, Graphics } from 'pixi.js';
import type RAPIER from '@dimforge/rapier2d-compat';
import {
  ROVER_WIDTH,
  ROVER_HEIGHT,
  PIXELS_PER_METER,
} from './constants';
import { tuning } from './tuning';
import { rapier, type RoverBody } from './physics';
import { applyThrust } from './physics';
import type { InputState } from './input';

export const ROVER_WHEEL_OFFSETS = [-1.1, 0, 1.1];

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
  const ppm = PIXELS_PER_METER;
  const hw = (ROVER_WIDTH / 2) * ppm;
  const hh = (ROVER_HEIGHT / 2) * ppm;
  const wheelR = hh * 0.45;
  const wheelY = hh * 0.85;

  const chassis = new Graphics();
  chassis.roundRect(-hw, -hh, hw * 2, hh * 1.3, 3);
  chassis.fill({ color: 0xaaaaaa });
  container.addChild(chassis);

  const equip = new Graphics();
  equip.roundRect(-hw * 0.4, -hh * 1.6, hw * 0.3, hh * 0.8, 2);
  equip.fill({ color: 0x999999 });
  equip.roundRect(hw * 0.1, -hh * 1.4, hw * 0.5, hh * 0.6, 2);
  equip.fill({ color: 0x888888 });
  container.addChild(equip);

  const antenna = new Graphics();
  antenna.moveTo(-hw * 0.2, -hh * 1.6);
  antenna.lineTo(-hw * 0.3, -hh * 2.5);
  antenna.stroke({ color: 0xcccccc, width: 1 });
  antenna.circle(-hw * 0.3, -hh * 2.5, 8);
  antenna.fill({ color: 0xdddddd, alpha: 0.8 });
  container.addChild(antenna);

  for (let i = 0; i < ROVER_WHEEL_OFFSETS.length; i++) {
    const wheel = new Graphics();
    wheel.circle(0, 0, wheelR);
    wheel.stroke({ color: 0x666666, width: 2 });
    wheel.moveTo(-wheelR, 0);
    wheel.lineTo(wheelR, 0);
    wheel.stroke({ color: 0x666666, width: 1 });
    wheel.moveTo(0, -wheelR);
    wheel.lineTo(0, wheelR);
    wheel.stroke({ color: 0x666666, width: 1 });
    wheel.x = ROVER_WHEEL_OFFSETS[i] * ppm;
    wheel.y = wheelY;
    wheel.label = `wheel${i}`;
    container.addChild(wheel);
  }

  const debugCollider = new Graphics();
  debugCollider.rect(-hw, -hh, hw * 2, hh * 2);
  debugCollider.stroke({ color: 0xff3355, width: 2, alpha: 0.9 });
  debugCollider.label = 'debugColliderBounds';
  debugCollider.visible = false;
  container.addChild(debugCollider);

  return container;
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
  const driveInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  rover.wheelDriveInput = driveInput;
  rover.wheelRotation += driveInput * tuning.roverWheelSpinSpeed * dt;

  rover.roverBoosting = input.up;
  if (rover.roverBoosting) {
    applyThrust(body, tuning.roverBoostForce * dt, { x: 1, y: 0 });
  }

  rover.isGrounded = false;
  let groundAngleX = 0;
  let groundAngleY = 0;
  let contacts = 0;

  for (let i = 0; i < ROVER_WHEEL_OFFSETS.length; i++) {
    const mount = localPoint(body, ROVER_WHEEL_OFFSETS[i], ROVER_HEIGHT * 0.1);
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

    const compression = tuning.roverSuspensionLength - hit.timeOfImpact;
    const hitPoint = ray.pointAt(hit.timeOfImpact);
    const pointVel = body.velocityAtPoint(hitPoint);
    const alongSpringSpeed = pointVel.x * down.x + pointVel.y * down.y;
    const springForce = Math.min(
      tuning.roverSuspensionMaxForce,
      Math.max(
        0,
        compression * tuning.roverSuspensionSpring +
          alongSpringSpeed * tuning.roverSuspensionDamping,
      ),
    );

    body.applyImpulseAtPoint({
      x: -down.x * springForce * dt,
      y: -down.y * springForce * dt,
    }, hitPoint, true);

    if (driveInput !== 0) {
      let tangent = { x: hit.normal.y, y: -hit.normal.x };
      const right = localVector(body, 1, 0);
      if (tangent.x * right.x + tangent.y * right.y < 0) {
        tangent = { x: -tangent.x, y: -tangent.y };
      }
      body.applyImpulseAtPoint({
        x: tangent.x * driveInput * tuning.roverAccel * dt / ROVER_WHEEL_OFFSETS.length,
        y: tangent.y * driveInput * tuning.roverAccel * dt / ROVER_WHEEL_OFFSETS.length,
      }, hitPoint, true);
      groundAngleX += tangent.x;
      groundAngleY += tangent.y;
    }

    rover.wheelTravel[i] = hit.timeOfImpact;
    rover.isGrounded = true;
    contacts++;
  }

  if (rover.isGrounded) {
    const tangent =
      contacts > 0
        ? { x: groundAngleX || Math.cos(rover.terrainAngle), y: groundAngleY || Math.sin(rover.terrainAngle) }
        : { x: Math.cos(rover.terrainAngle), y: Math.sin(rover.terrainAngle) };
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    tangent.x /= tangentLength;
    tangent.y /= tangentLength;

    const vel = body.linvel();
    const tangentSpeed = vel.x * tangent.x + vel.y * tangent.y;
    const clampedSpeed = Math.max(
      -tuning.roverMaxSpeed,
      Math.min(tuning.roverMaxSpeed, tangentSpeed),
    );

    if (clampedSpeed !== tangentSpeed) {
      const delta = clampedSpeed - tangentSpeed;
      body.setLinvel({
        x: vel.x + tangent.x * delta,
        y: vel.y + tangent.y * delta,
      }, true);
    }

    body.setAngvel(body.angvel() * 0.9, true);
  }
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
