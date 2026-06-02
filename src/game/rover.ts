import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import roverSvgUrl from '../data/Rover.svg?url';
import {
  LUNAR_ROVER_MASS,
  ROVER_WIDTH,
  ROVER_HEIGHT,
  PIXELS_PER_METER,
} from './constants';
import { tuning } from './tuning';
import { type RoverBody } from './physics';
import type { InputState } from './input';
import { getTerrainHeightAt } from './terrain';

export const ROVER_WHEEL_OFFSETS = [-0.95, 0.95];
const WIREFRAME_COLOR = 0xffffff;
const ROVER_SVG_ASPECT = 600 / 347;
let roverTexture: Texture | null = null;

export async function loadRoverGraphics() {
  roverTexture = await Assets.load<Texture>(roverSvgUrl);
}

export interface Rover {
  container: Container;
  body: RoverBody;
  fuel?: number;
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

/**
 * Treat the rover as one rolling ball over the terrain heightmap. Rapier still
 * owns the shared body, but terrain contact is resolved from surfaceHeights so
 * wheel contacts cannot fight each other over jagged ground.
 */
export function updateRoverPhysics(
  rover: Rover,
  input: InputState,
  dt: number,
  terrainHeights: number[],
) {
  const body = rover.body.rigidBody;
  const driveInput = input.right - input.left;
  const boostInput = input.up > 0 && (rover.fuel ?? 0) > 0;
  const boostDv = boostInput
    ? (tuning.roverBoostForce / LUNAR_ROVER_MASS) * dt
    : 0;
  const radius = ROVER_HEIGHT * 0.5;
  const sample = ROVER_WIDTH * 0.45;
  const pos = body.translation();
  const vel = body.linvel();
  const surfaceY = getTerrainHeightAt(terrainHeights, pos.x);
  const leftY = getTerrainHeightAt(terrainHeights, pos.x - sample);
  const rightY = getTerrainHeightAt(terrainHeights, pos.x + sample);
  const slope = Math.atan2(rightY - leftY, sample * 2);
  const grade = (rightY - leftY) / (sample * 2);
  const groundY = surfaceY - radius - 0.08;
  const verticalGap = groundY - pos.y;
  const snapDistance = 1.1;
  const travelDirection = Math.sign(vel.x || driveInput || 1);
  const aheadY = getTerrainHeightAt(
    terrainHeights,
    pos.x + travelDirection * (sample + radius),
  );
  const leadingEdgeDropped =
    Math.abs(vel.x) > 2 && aheadY - surfaceY > radius * 1.2;
  const grounded = verticalGap <= snapDistance && !leadingEdgeDropped;

  rover.roverBoosting = boostInput;
  if (boostInput && rover.fuel != null) {
    rover.fuel = Math.max(0, rover.fuel - tuning.roverBoostFuelBurn * dt);
  }
  rover.isGrounded = grounded;
  rover.terrainAngle = slope;
  rover.terrainDistance = Math.max(0, verticalGap);
  rover.wheelTravel = rover.wheelTravel.map(() =>
    grounded ? radius * 0.18 : tuning.roverSuspensionLength,
  );

  if (grounded) {
    let nextVx = vel.x;

    if (driveInput !== 0) {
      const speedAlong = nextVx * Math.sign(driveInput);
      const speedFactor = Math.max(0.25, 1 - speedAlong / tuning.roverMaxSpeed);
      nextVx +=
        driveInput * (tuning.roverAccel / LUNAR_ROVER_MASS) * speedFactor * dt;
    } else {
      const maxBrake = tuning.roverGrip * dt;
      nextVx -= Math.sign(nextVx) * Math.min(Math.abs(nextVx), maxBrake);
    }
    nextVx += boostDv;

    const maxSpeed = tuning.roverMaxSpeed + (boostInput ? 18 : 0);
    nextVx = Math.max(-tuning.roverMaxSpeed, Math.min(maxSpeed, nextVx));
    const nextVy = grade * nextVx;

    body.setTranslation({ x: pos.x, y: groundY }, true);
    body.setLinvel({ x: nextVx, y: nextVy }, true);
    body.setRotation(slope, true);
    body.setAngvel(0, true);
    rover.wheelRotation +=
      (nextVx / Math.max(0.1, radius)) * tuning.roverWheelSpinSpeed * 0.08 * dt;
  } else {
    if (boostInput) {
      body.setLinvel(
        { x: Math.min(vel.x + boostDv, tuning.roverMaxSpeed + 18), y: vel.y },
        true,
      );
    }
    if (driveInput !== 0) {
      body.applyTorqueImpulse(driveInput * tuning.roverAirTorque * dt, true);
    }
    rover.terrainDistance = Infinity;
  }

  const hardCap = tuning.roverMaxSpeed + 24;
  const nextVel = body.linvel();
  if (Math.abs(nextVel.x) > hardCap) {
    body.setLinvel(
      { x: Math.sign(nextVel.x) * hardCap, y: nextVel.y },
      true,
    );
  }

  rover.wheelDriveInput = Math.sign(body.linvel().x);
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
