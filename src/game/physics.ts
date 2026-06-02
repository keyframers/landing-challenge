import RAPIER from '@dimforge/rapier2d-compat';
import {
  LANDER_WIDTH,
  LANDER_HEIGHT,
  LUNAR_MODULE_MASS,
  ROVER_WIDTH,
  ROVER_HEIGHT,
  TERRAIN_SEGMENT_SIZE,
  LUNAR_ROVER_MASS,
} from './constants';
import { tuning } from './tuning';

export let rapier: typeof RAPIER;

export async function initPhysics() {
  await RAPIER.init();
  rapier = RAPIER;
  return RAPIER;
}

export function createWorld(): RAPIER.World {
  return new RAPIER.World({ x: 0.0, y: tuning.gravity });
}

export function createTerrainCollider(
  world: RAPIER.World,
  heights: number[],
): RAPIER.Collider {
  const vertices = new Float32Array(heights.length * 2);

  for (let i = 0; i < heights.length; i++) {
    vertices[i * 2] = i * TERRAIN_SEGMENT_SIZE;
    vertices[i * 2 + 1] = heights[i];
  }

  const bodyDesc = RAPIER.RigidBodyDesc.fixed();
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.polyline(vertices);
  colliderDesc.setFriction(0.8);
  colliderDesc.setRestitution(0.1);

  return world.createCollider(colliderDesc, body);
}

export interface LanderBody {
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export type VehicleColliderMode = 'lander' | 'rover';

function createVehicleColliderDesc(mode: VehicleColliderMode): RAPIER.ColliderDesc {
  if (mode === 'rover') {
    return RAPIER.ColliderDesc.ball(ROVER_HEIGHT / 2)
      .setFriction(1.4)
      .setRestitution(0)
      .setDensity(0.1);
  }

  return RAPIER.ColliderDesc.cuboid(LANDER_WIDTH / 2, LANDER_HEIGHT / 2)
    .setFriction(0.5)
    .setRestitution(0)
    .setDensity(2.0);
}

export function createLanderBody(
  world: RAPIER.World,
  x: number,
  y: number,
): LanderBody {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y)
    .setLinearDamping(0)
    .setAngularDamping(0.5);

  const rigidBody = world.createRigidBody(bodyDesc);

  const collider = world.createCollider(
    createVehicleColliderDesc('lander'),
    rigidBody,
  );
  applyLanderMass(rigidBody);

  return { rigidBody, collider };
}

function applyLanderMass(rigidBody: RAPIER.RigidBody) {
  const inertia =
    (LUNAR_MODULE_MASS *
      (LANDER_WIDTH * LANDER_WIDTH + LANDER_HEIGHT * LANDER_HEIGHT)) /
    12;
  rigidBody.setAdditionalMassProperties(
    LUNAR_MODULE_MASS,
    { x: 0, y: 0 },
    inertia,
    true,
  );
}

export function replaceVehicleCollider(
  world: RAPIER.World,
  body: LanderBody,
  mode: VehicleColliderMode,
) {
  world.removeCollider(body.collider, true);
  body.collider = world.createCollider(
    createVehicleColliderDesc(mode),
    body.rigidBody,
  );

  if (mode === 'rover') {
    const inertia = (LUNAR_ROVER_MASS * ROVER_HEIGHT * ROVER_HEIGHT) / 8;
    body.rigidBody.setAdditionalMassProperties(
      LUNAR_ROVER_MASS,
      { x: 0, y: 0 },
      inertia,
      true,
    );
    body.rigidBody.setAngularDamping(3);
  } else {
    applyLanderMass(body.rigidBody);
    body.rigidBody.setAngularDamping(0.5);
  }
}

export interface RoverBody {
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export function createRoverBody(
  world: RAPIER.World,
  x: number,
  y: number,
): RoverBody {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y)
    .setLinearDamping(0.3)
    .setAngularDamping(2.0);

  const rigidBody = world.createRigidBody(bodyDesc);

  const hw = ROVER_WIDTH / 2;
  const hh = ROVER_HEIGHT / 2;

  const colliderDesc = RAPIER.ColliderDesc.cuboid(hw, hh)
    .setFriction(1.0)
    .setRestitution(0.2)
    .setDensity(1.5);

  const collider = world.createCollider(colliderDesc, rigidBody);

  return { rigidBody, collider };
}

export function applyThrust(
  body: RAPIER.RigidBody,
  force: number,
  localDirection: { x: number; y: number },
) {
  const angle = body.rotation();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const worldForce = {
    x: (cos * localDirection.x - sin * localDirection.y) * force,
    y: (sin * localDirection.x + cos * localDirection.y) * force,
  };

  body.applyImpulse(worldForce, true);
}

export function applyTorque(body: RAPIER.RigidBody, torque: number) {
  body.applyTorqueImpulse(torque, true);
}
