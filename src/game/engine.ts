import { Application, Container } from 'pixi.js';
import { createBrowserInspector } from '@statelyai/inspect';
import { createActor, type Actor } from 'xstate';
import { gameMachine } from '../machines/gameMachine';
import { missions } from '../data/missions';
import {
  initPhysics,
  createWorld,
  createTerrainCollider,
  createLanderBody,
  applyThrust,
  replaceVehicleCollider,
  type LanderBody,
} from './physics';
import { createTerrainSystem, getTerrainHeightAt } from './terrain';
import {
  createCamera,
  frameCamera,
  setCameraFramed,
  type Camera,
} from './camera';
import {
  createLanderGraphics,
  updateLanderPhysics,
  emitLanderParticles,
  checkLanding,
  type Lander,
} from './lander';
import {
  createRoverGraphics,
  ROVER_WHEEL_OFFSETS,
  syncRoverGraphics,
  updateRoverPhysics,
  type Rover,
} from './rover';
import { ParticleSystem } from './particles';
import { createStarfield, createEarth } from './starfield';
import { InputManager } from './input';
import { tuning } from './tuning';
import {
  FIXED_TIMESTEP,
  LANDER_HEIGHT,
  PIXELS_PER_METER,
  ROVER_HEIGHT,
  ROVER_WIDTH,
  TELEMETRY_HZ,
} from './constants';
import type RAPIER from '@dimforge/rapier2d-compat';

export interface Game {
  app: Application;
  actor: Actor<typeof gameMachine>;
  input: InputManager;
  destroy: () => void;
}

type VehicleMode = 'lander' | 'rover';

/**
 * A single persistent entity. Switching between lander and rover only changes
 * behaviour — never the body — so there's no spawn/despawn dance:
 *  - lander mode: rocket thrust + rotation, destructible
 *  - rover mode:  left/right drive the wheels, indestructible
 */
interface Vehicle {
  body: LanderBody;
  landerGfx: Container;
  roverGfx: Container;
  mode: VehicleMode;
  fuel: number;
  thrustLevel: number;
  destroyed: boolean;
  leftEngineOn: boolean;
  rightEngineOn: boolean;
  mainEngineOn: boolean;
  isGrounded: boolean;
  isRighting: boolean;
  terrainAngle: number;
  terrainDistance: number;
  roverBoosting: boolean;
  wheelRotation: number;
  wheelDriveInput: number;
  wheelTravel: number[];
}

export async function createGame(
  canvas: HTMLCanvasElement,
  onProgress?: (pct: number) => void,
): Promise<Game> {
  onProgress?.(0.1);

  await initPhysics();
  onProgress?.(0.4);

  const app = new Application();
  await app.init({
    canvas,
    resizeTo: window,
    backgroundColor: 0x0a0a14,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  onProgress?.(0.6);

  const inspector = createBrowserInspector({
    filter: (event) => {
      if (event.type === '@xstate.event') {
        return event.event.type !== 'UPDATE_TELEMETRY';
      }
      if (event.type === '@xstate.snapshot') {
        return event.event.type !== 'UPDATE_TELEMETRY';
      }
      return true;
    },
    url: 'https://editor.stately.ai',
  });
  const actor = createActor(gameMachine, { inspect: inspector.inspect });
  const input = new InputManager();

  const worldContainer = new Container();
  const starContainer = new Container();
  const terrainContainer = new Container();
  const entityContainer = new Container();
  const particleContainer = new Container();
  const uiWorldContainer = new Container();

  app.stage.addChild(starContainer);
  app.stage.addChild(worldContainer);
  worldContainer.addChild(terrainContainer);
  worldContainer.addChild(entityContainer);
  worldContainer.addChild(particleContainer);
  worldContainer.addChild(uiWorldContainer);

  const starfield = createStarfield(app.screen.width, app.screen.height);
  starContainer.addChild(starfield);

  const earth = createEarth();
  earth.x = app.screen.width * 0.8;
  earth.y = app.screen.height * 0.15;
  starContainer.addChild(earth);

  const terrain = createTerrainSystem();
  for (const layer of terrain.layers) {
    terrainContainer.addChild(layer.container);
  }
  uiWorldContainer.addChild(terrain.landingZoneMarkers);

  const world: RAPIER.World = createWorld();
  createTerrainCollider(world, terrain.surfaceHeights);

  const camera = createCamera(app.screen.width, app.screen.height);
  const particles = new ParticleSystem();
  particleContainer.addChild(particles.container);

  let vehicle: Vehicle | null = null;
  let accumulator = 0;

  interface TransitState {
    toX: number;
    burnRemaining: number;
    elapsed: number;
  }
  let transit: TransitState | null = null;

  interface SimulatedLandingState {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    peakY: number;
    elapsed: number;
    duration: number;
  }
  let simulatedLanding: SimulatedLandingState | null = null;

  function getLandingTarget(missionIndex: number): { x: number; y: number } {
    const mission = missions[missionIndex];
    const x =
      mission.terrain.landingZoneX + mission.terrain.landingZoneWidth / 2;
    const y = getTerrainHeightAt(terrain.foregroundHeights, x);
    return { x, y };
  }

  function getMissionSpawn(missionIndex: number): { x: number; y: number } {
    const mission = missions[missionIndex];
    const x =
      mission.terrain.landingZoneX + mission.terrain.landingZoneWidth / 2;
    // startAltitude is globally tunable so it can be experimented with.
    const y =
      getTerrainHeightAt(terrain.foregroundHeights, x) - tuning.startAltitude;
    return { x, y };
  }

  function removeVehicle() {
    if (!vehicle) return;
    entityContainer.removeChild(vehicle.landerGfx);
    entityContainer.removeChild(vehicle.roverGfx);
    world.removeRigidBody(vehicle.body.rigidBody);
    vehicle = null;
  }

  function spawnVehicle(missionIndex: number) {
    removeVehicle();

    const { x, y } = getMissionSpawn(missionIndex);
    const body = createLanderBody(world, x, y);
    const landerGfx = createLanderGraphics();
    const roverGfx = createRoverGraphics();
    roverGfx.visible = false;
    entityContainer.addChild(landerGfx);
    entityContainer.addChild(roverGfx);

    vehicle = {
      body,
      landerGfx,
      roverGfx,
      mode: 'lander',
      fuel: 100,
      thrustLevel: 0,
      destroyed: false,
      leftEngineOn: false,
      rightEngineOn: false,
      mainEngineOn: false,
      isGrounded: false,
      isRighting: false,
      terrainAngle: 0,
      terrainDistance: Infinity,
      roverBoosting: false,
      wheelRotation: 0,
      wheelDriveInput: 0,
      wheelTravel: ROVER_WHEEL_OFFSETS.map(() => tuning.roverSuspensionLength),
    };

    const target = getLandingTarget(missionIndex);
    setCameraFramed(camera, x, y, target.x, target.y);
  }

  function setVehicleMode(mode: VehicleMode) {
    if (!vehicle) return;
    if (vehicle.mode !== mode) {
      const body = vehicle.body.rigidBody;
      const pos = body.translation();
      const prevHalfHeight =
        vehicle.mode === 'rover' ? ROVER_HEIGHT / 2 : LANDER_HEIGHT / 2;
      const nextHalfHeight =
        mode === 'rover' ? ROVER_HEIGHT / 2 : LANDER_HEIGHT / 2;

      replaceVehicleCollider(world, vehicle.body, mode);
      body.setTranslation(
        {
          x: pos.x,
          y: pos.y + prevHalfHeight - nextHalfHeight,
        },
        true,
      );
      body.setAngvel(0, true);
    }

    vehicle.mode = mode;
    vehicle.landerGfx.visible = mode === 'lander';
    vehicle.roverGfx.visible = mode === 'rover';
  }

  function placeVehicleLanded(missionIndex: number) {
    if (!vehicle) return;
    const target = getLandingTarget(missionIndex);
    const body = vehicle.body.rigidBody;
    body.setTranslation({ x: target.x, y: target.y - LANDER_HEIGHT / 2 }, true);
    body.setLinvel({ x: 0, y: 0 }, true);
    body.setAngvel(0, true);
    body.setRotation(0, true);
    vehicle.destroyed = false;
    vehicle.thrustLevel = 0;
    setVehicleMode('lander');
  }

  function startSimulatedLanding(missionIndex: number) {
    if (!vehicle) spawnVehicle(missionIndex);
    if (!vehicle) return;

    const target = getLandingTarget(missionIndex);
    const body = vehicle.body.rigidBody;
    const startY = target.y - LANDER_HEIGHT / 2 - 45;
    vehicle.destroyed = false;
    vehicle.thrustLevel = 0;
    setVehicleMode('lander');

    simulatedLanding = {
      fromX: target.x,
      fromY: startY,
      toX: target.x,
      toY: target.y - LANDER_HEIGHT / 2,
      peakY: startY,
      elapsed: 0,
      duration: 1.5,
    };

    body.setTranslation({ x: target.x, y: startY }, true);
    body.setLinvel({ x: 0, y: 0 }, true);
    body.setAngvel(0, true);
    body.setRotation(0, true);
  }

  function syncVehicleGraphics() {
    if (!vehicle) return;
    const pos = vehicle.body.rigidBody.translation();
    const rot = vehicle.body.rigidBody.rotation();
    const ppm = PIXELS_PER_METER;

    const gfx =
      vehicle.mode === 'lander' ? vehicle.landerGfx : vehicle.roverGfx;
    gfx.x = pos.x * ppm;
    gfx.y = pos.y * ppm;
    gfx.rotation = rot;

    for (const container of [vehicle.landerGfx, vehicle.roverGfx]) {
      const debugBounds = container.children.find(
        (c) => c.label === 'debugColliderBounds',
      );
      if (debugBounds) debugBounds.visible = tuning.showDebugBounds;
    }

    if (vehicle.mode === 'lander') {
      const glow = vehicle.landerGfx.children.find(
        (c) => c.label === 'engineGlow',
      );
      if (glow) glow.alpha = vehicle.thrustLevel * 0.6;
    } else {
      syncRoverGraphics({
        ...(vehicle as unknown as Rover),
        container: vehicle.roverGfx,
      });
    }
  }

  // The launch/transit arc is driven by the Pixi ticker (see updateTransit) so
  // it shares the physics clock and pauses cleanly. It is used both for hopping
  // to the next mission and for relaunching from the rover back up to the
  // current mission's starting point.
  function startTransit(targetMissionIndex: number) {
    if (!vehicle) return;
    setVehicleMode('lander');

    const to = getLandingTarget(targetMissionIndex);
    const pos = vehicle.body.rigidBody.translation();

    const body = vehicle.body.rigidBody;
    const dx = to.x - pos.x;
    const vx = Math.max(
      -tuning.transitMaxHorizontalSpeed,
      Math.min(tuning.transitMaxHorizontalSpeed, dx / tuning.transitMaxSeconds),
    );
    const launchAngle = Math.sign(dx || 1) * tuning.transitLaunchAngle;

    transit = {
      toX: to.x,
      burnRemaining: tuning.transitEngineBurnSeconds,
      elapsed: 0,
    };

    body.setLinvel({ x: vx, y: 0 }, true);
    body.setAngvel(0, true);
    body.setRotation(launchAngle, true);
  }

  function updateTransit(delta: number) {
    if (!transit || !vehicle) return;

    transit.elapsed += delta;
    world.gravity = { x: 0, y: tuning.gravity };
    const body = vehicle.body.rigidBody;
    accumulator += delta;
    while (accumulator >= FIXED_TIMESTEP) {
      updateLanderPhysics(
        vehicle as unknown as Lander,
        input.state,
        FIXED_TIMESTEP,
      );

      if (transit.burnRemaining > 0) {
        applyThrust(body, tuning.transitLaunchForce * FIXED_TIMESTEP, {
          x: 0,
          y: -1,
        });
        vehicle.thrustLevel = 1;
        transit.burnRemaining -= FIXED_TIMESTEP;
      }

      world.step();

      const vel = body.linvel();
      if (Math.abs(vel.x) > tuning.transitMaxHorizontalSpeed) {
        body.setLinvel(
          {
            x: Math.sign(vel.x) * tuning.transitMaxHorizontalSpeed,
            y: vel.y,
          },
          true,
        );
      }

      accumulator -= FIXED_TIMESTEP;
    }

    const pos = body.translation();
    const vel = body.linvel();
    const terrainH = getTerrainHeightAt(terrain.surfaceHeights, pos.x);
    const altitude = terrainH - pos.y - LANDER_HEIGHT / 2;
    if (Math.abs(pos.x - transit.toX) < tuning.transitHandOffDistance) {
      body.setLinvel(
        {
          x: Math.max(
            -tuning.transitMaxHorizontalSpeed,
            Math.min(tuning.transitMaxHorizontalSpeed, vel.x),
          ),
          y: vel.y,
        },
        true,
      );
    }
    syncVehicleGraphics();

    particleTimer += delta;
    if (particleTimer >= 0.03) {
      emitLanderParticles(vehicle as unknown as Lander, particles);
      particleTimer = 0;
    }

    if (
      (vel.y > 0 && altitude <= tuning.transitPlayableAltitude) ||
      transit.elapsed >= tuning.transitMaxSeconds
    ) {
      transit = null;
      vehicle.fuel = 100;
      vehicle.destroyed = false;
      vehicle.thrustLevel = 0;
      actor.send({ type: 'ARRIVED' });
    }
  }

  function checkContactAndLanding() {
    if (!vehicle || vehicle.destroyed) return;

    const state = actor.getSnapshot();
    if (!state.matches({ playing: 'descending' })) return;

    // contactPairsWith is broad-phase, so use an altitude check against the
    // terrain to detect actual ground contact.
    const pos = vehicle.body.rigidBody.translation();
    const vel = vehicle.body.rigidBody.linvel();
    const angle = vehicle.body.rigidBody.rotation();
    const speed = Math.hypot(vel.x, vel.y);
    const absAngle = Math.abs(angle % (Math.PI * 2));
    const normalizedAngle =
      absAngle > Math.PI ? Math.PI * 2 - absAngle : absAngle;
    const terrainH = getTerrainHeightAt(terrain.surfaceHeights, pos.x);
    const bottomY = pos.y + LANDER_HEIGHT / 2;
    if (bottomY < terrainH - 0.25) return;

    if (
      speed > tuning.maxLandingSpeed ||
      normalizedAngle > tuning.maxLandingAngle
    ) {
      vehicle.destroyed = true;
      vehicle.body.rigidBody.setLinvel({ x: 0, y: 0 }, true);
      vehicle.body.rigidBody.setAngvel(0, true);
      particles.emitExplosion(pos.x, pos.y);
      vehicle.landerGfx.visible = false;
      actor.send({ type: 'CRASHED' });
      return;
    }

    const missionIndex = missions.findIndex((mission) => {
      const { landingZoneX, landingZoneWidth } = mission.terrain;
      return pos.x >= landingZoneX && pos.x <= landingZoneX + landingZoneWidth;
    });
    const result =
      missionIndex === -1
        ? { type: 'missed' as const }
        : checkLanding(
            vehicle as unknown as Lander,
            missions[missionIndex].terrain.landingZoneX,
            missions[missionIndex].terrain.landingZoneWidth,
          );

    if (!result) return;

    if (result.type === 'crashed') {
      vehicle.destroyed = true;
      vehicle.body.rigidBody.setLinvel({ x: 0, y: 0 }, true);
      vehicle.body.rigidBody.setAngvel(0, true);
      particles.emitExplosion(pos.x, pos.y);
      vehicle.landerGfx.visible = false;
      actor.send({ type: 'CRASHED' });
    } else if (result.type === 'missed') {
      actor.send({ type: 'MISSED' });
    } else {
      particles.emitDust(pos.x, pos.y);
      vehicle.body.rigidBody.setLinvel({ x: 0, y: 0 }, true);
      vehicle.body.rigidBody.setAngvel(0, true);
      actor.send({ type: 'LANDED', missionIndex });
    }
  }

  function updateGrounded() {
    if (!vehicle) return;
    const pos = vehicle.body.rigidBody.translation();
    const terrainH = getTerrainHeightAt(terrain.surfaceHeights, pos.x);
    const halfHeight =
      vehicle.mode === 'rover' ? ROVER_HEIGHT / 2 : LANDER_HEIGHT / 2;
    const bottomY = pos.y + halfHeight;
    vehicle.terrainDistance = terrainH - bottomY;
    vehicle.isGrounded = vehicle.terrainDistance <= 0.35;
    const leftH = getTerrainHeightAt(terrain.surfaceHeights, pos.x - 2);
    const rightH = getTerrainHeightAt(terrain.surfaceHeights, pos.x + 2);
    vehicle.terrainAngle = Math.atan2(rightH - leftH, 4);
  }

  let prevPlayingState: string | null = null;

  actor.subscribe((state) => {
    const v = state.value;
    const playing =
      typeof v === 'object' && 'playing' in v
        ? ((v as any).playing as string)
        : null;

    if (playing === prevPlayingState) return;
    const prev = prevPlayingState;
    prevPlayingState = playing;

    // Left the playing region (title/manual/etc). Reset so the next entry is
    // treated as a fresh launch.
    if (playing === null) return;

    const resumingFromPause = prev === 'paused';
    if (resumingFromPause) return; // history resume — keep everything as-is

    switch (playing) {
      case 'descending':
        if (prev === 'transit' || prev === 'rover') {
          // Arrived via transit or switched back from rover — the vehicle is
          // already positioned, so keep the body and make it playable.
          if (vehicle) {
            vehicle.fuel = 100;
            vehicle.destroyed = false;
            setVehicleMode('lander');
            if (prev === 'rover') {
              const vel = vehicle.body.rigidBody.linvel();
              vehicle.body.rigidBody.setLinvel({ x: vel.x, y: 0 }, true);
              vehicle.body.rigidBody.setAngvel(0, true);
            }
          }
        } else {
          // Fresh launch / retry: spawn a new vehicle at the mission start.
          accumulator = 0;
          spawnVehicle(state.context.currentMission);
        }
        break;

      case 'rover':
        // Same entity — just change behaviour.
        setVehicleMode('rover');
        break;

      case 'landed':
        setVehicleMode('lander');
        break;

      case 'simulatingLanding':
        startSimulatedLanding(state.context.currentMission);
        break;

      case 'transit':
        startTransit(state.context.currentMission);
        break;

      case 'crashed':
      case 'missed':
      case 'paused':
        break;
    }
  });

  input.setKonamiCallback(() => {
    actor.send({ type: 'KONAMI' });
  });

  input.setAnyControlCallback(() => {
    const state = actor.getSnapshot();
    if (state.matches('manual')) {
      actor.send({ type: 'CONTROLS_PRESSED' });
    }
  });

  input.setEscapeCallback(() => {
    const state = actor.getSnapshot();
    if (state.matches({ playing: 'paused' })) {
      actor.send({ type: 'RESUME' });
    } else if (typeof state.value === 'object' && 'playing' in state.value) {
      actor.send({ type: 'PAUSE' });
    }
  });

  let particleTimer = 0;
  let telemetryTimer = 0;
  const TELEMETRY_INTERVAL = 1 / TELEMETRY_HZ;

  function sendTelemetry() {
    if (!vehicle) return;
    const pos = vehicle.body.rigidBody.translation();
    const vel = vehicle.body.rigidBody.linvel();
    const terrainH = getTerrainHeightAt(terrain.surfaceHeights, pos.x);
    const altitude = terrainH - pos.y - LANDER_HEIGHT / 2;

    actor.send({
      type: 'UPDATE_TELEMETRY',
      velocity: { x: vel.x, y: vel.y },
      altitude: Math.max(0, altitude),
      angle: vehicle.body.rigidBody.rotation(),
      fuel: vehicle.fuel,
      thrustLevel: vehicle.thrustLevel,
    });
  }

  function updateSimulatedLanding(delta: number) {
    if (!vehicle || !simulatedLanding) return;

    simulatedLanding.elapsed = Math.min(
      simulatedLanding.duration,
      simulatedLanding.elapsed + delta,
    );
    const t = simulatedLanding.elapsed / simulatedLanding.duration;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const x =
      simulatedLanding.fromX +
      (simulatedLanding.toX - simulatedLanding.fromX) * eased;
    const y =
      simulatedLanding.fromY * (1 - eased) * (1 - eased) +
      simulatedLanding.peakY * 2 * eased * (1 - eased) +
      simulatedLanding.toY * eased * eased;

    const body = vehicle.body.rigidBody;
    body.setTranslation({ x, y }, true);
    body.setLinvel({ x: 0, y: 0 }, true);
    body.setAngvel(0, true);
    body.setRotation(0, true);
    syncVehicleGraphics();

    if (t >= 1) {
      simulatedLanding = null;
      placeVehicleLanded(actor.getSnapshot().context.currentMission);
      actor.send({
        type: 'LANDED',
        missionIndex: actor.getSnapshot().context.currentMission,
      });
    }
  }

  function emitRoverBoostParticles() {
    if (!vehicle || !vehicle.roverBoosting) return;

    const body = vehicle.body.rigidBody;
    const pos = body.translation();
    const rot = body.rotation();
    const leftEngineX = pos.x + Math.cos(rot) * (-ROVER_WIDTH / 2);
    const leftEngineY = pos.y + Math.sin(rot) * (-ROVER_WIDTH / 2);
    particles.emitThrust(leftEngineX, leftEngineY, rot + Math.PI / 2, 1);
  }

  app.ticker.add((ticker) => {
    const state = actor.getSnapshot();
    // Clamp delta so a long stall (e.g. backgrounded tab) can't spiral physics.
    const delta = Math.min(ticker.deltaMS / 1000, 0.05);

    const playing =
      typeof state.value === 'object' && 'playing' in state.value
        ? ((state.value as any).playing as string)
        : null;

    if (playing === 'descending' && vehicle && !vehicle.destroyed) {
      world.gravity = { x: 0, y: tuning.gravity };
      accumulator += delta;
      while (accumulator >= FIXED_TIMESTEP) {
        updateLanderPhysics(
          vehicle as unknown as Lander,
          input.state,
          FIXED_TIMESTEP,
        );
        world.step();
        accumulator -= FIXED_TIMESTEP;
      }

      syncVehicleGraphics();

      particleTimer += delta;
      if (particleTimer >= 0.03) {
        emitLanderParticles(vehicle as unknown as Lander, particles);
        particleTimer = 0;
      }

      checkContactAndLanding();

      telemetryTimer += delta;
      if (telemetryTimer >= TELEMETRY_INTERVAL) {
        telemetryTimer = 0;
        sendTelemetry();
      }
    } else if (playing === 'rover' && vehicle) {
      world.gravity = { x: 0, y: tuning.gravity };
      accumulator += delta;
      while (accumulator >= FIXED_TIMESTEP) {
        updateGrounded();
        updateRoverPhysics(
          vehicle as unknown as Rover,
          input.state,
          FIXED_TIMESTEP,
          world,
        );
        world.step();
        accumulator -= FIXED_TIMESTEP;
      }
      updateGrounded();
      syncVehicleGraphics();

      particleTimer += delta;
      if (particleTimer >= 0.03) {
        emitRoverBoostParticles();
        particleTimer = 0;
      }

      telemetryTimer += delta;
      if (telemetryTimer >= TELEMETRY_INTERVAL) {
        telemetryTimer = 0;
        sendTelemetry();
      }
    } else if (playing === 'transit') {
      updateTransit(delta);
    } else if (playing === 'simulatingLanding') {
      updateSimulatedLanding(delta);
    } else if (vehicle) {
      // landed / crashed / missed / paused: hold position, keep graphics synced.
      syncVehicleGraphics();
    }

    applyCamera(state, playing);
  });

  function applyCamera(state: any, playing: string | null) {
    if (vehicle && !vehicle.destroyed) {
      const pos = vehicle.body.rigidBody.translation();
      const target = getLandingTarget(state.context.currentMission);
      frameCamera(camera, pos.x, pos.y, target.x, target.y);
    }

    const sw = app.screen.width;
    const sh = app.screen.height;

    worldContainer.scale.set(camera.zoom);
    worldContainer.x = sw / 2 - camera.x * camera.zoom;
    worldContainer.y = sh / 2 - camera.y * camera.zoom;

    // parallax — background layers (pf<1) move slower than the camera.
    for (const layer of terrain.layers) {
      const pf = layer.parallaxFactor;
      layer.container.x = camera.x * (1 - pf);
    }

    starContainer.x = -camera.x * 0.02;
    starContainer.y = -camera.y * 0.02;
  }

  function handleResize() {
    camera.screenWidth = window.innerWidth;
    camera.screenHeight = window.innerHeight;
  }

  window.addEventListener('resize', handleResize);

  onProgress?.(1.0);

  actor.start();

  return {
    app,
    actor,
    input,
    destroy() {
      actor.stop();
      input.destroy();
      window.removeEventListener('resize', handleResize);
      transit = null;
      simulatedLanding = null;
      particles.destroy();
      app.destroy(true);
    },
  };
}
