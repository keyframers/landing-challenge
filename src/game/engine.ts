import { Application, Container } from "pixi.js";
import gsap from "gsap";
import { createBrowserInspector } from "@statelyai/inspect";
import { createActor, type Actor } from "xstate";
import { gameMachine } from "../machines/gameMachine";
import { missions } from "../data/missions";
import {
  initPhysics,
  createWorld,
  createTerrainCollider,
  createLanderBody,
  applyThrust,
  replaceVehicleCollider,
  type LanderBody,
} from "./physics";
import {
  createTerrainSystem,
  generateVisualForegroundHeightmap,
  getTerrainHeightAt,
  redrawTerrainSystem,
  updateLandingZoneProximity,
} from "./terrain";
import { createCamera, focusCamera, frameCamera, setCameraFramed, type Camera } from "./camera";
import {
  createLanderGraphics,
  drawLanderGraphics,
  updateLanderPhysics,
  emitLanderParticles,
  checkLanding,
  loadLanderGraphics,
  type Lander,
} from "./lander";
import {
  createRoverGraphics,
  drawRoverGraphics,
  loadRoverGraphics,
  ROVER_WHEEL_OFFSETS,
  syncRoverGraphics,
  updateRoverPhysics,
  type Rover,
} from "./rover";
import { ParticleSystem } from "./particles";
import { createStarfield, createEarth, loadEarthGraphics } from "./starfield";
import { InputManager } from "./input";
import { tuning } from "./tuning";
import {
  MAX_FUEL,
  FIXED_TIMESTEP,
  LANDER_HEIGHT,
  LANDER_WIDTH,
  PIXELS_PER_METER,
  ROVER_HEIGHT,
  TELEMETRY_HZ,
  TERRAIN_TOTAL_WIDTH,
} from "./constants";
import type RAPIER from "@dimforge/rapier2d-compat";

export interface Game {
  app: Application;
  actor: Actor<typeof gameMachine>;
  input: InputManager;
  destroy: () => void;
}

type VehicleMode = "lander" | "rover";
type BrowserInspector = ReturnType<typeof createBrowserInspector>;
type InspectWindow = Window & { __xstateInspector?: BrowserInspector };
const RETURN_TO_LANDER_CLEARANCE = 1.5;
const RETURN_TO_LANDER_BOOST_SPEED = 8;
const RETURN_TO_LANDER_BOOST_IMPULSE = 90;
const MANUAL_CAMERA_ZOOM = 1.4;
const LANDED_CAMERA_ZOOM = 2.4;

const inspector = createBrowserInspector({
  filter: (event) => {
    if (event.type === "@xstate.event") {
      return event.event.type !== "UPDATE_TELEMETRY";
    }
    if (event.type === "@xstate.snapshot") {
      return event.event.type !== "UPDATE_TELEMETRY";
    }
    return true;
  },
  maxDeferredEvents: 50,
  url: "https://editor.stately.ai",
  autoStart: false,
});
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
  onProgress?: (pct: number) => void
): Promise<Game> {
  onProgress?.(0.1);

  await initPhysics();
  onProgress?.(0.4);

  const app = new Application();
  await app.init({
    canvas,
    resizeTo: window,
    backgroundColor: tuning.wireframe ? 0x000000 : 0x0a0a14,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  onProgress?.(0.6);

  await Promise.all([loadLanderGraphics(), loadRoverGraphics(), loadEarthGraphics()]);
  onProgress?.(0.75);

  const actor = createActor(gameMachine, inspector ? { inspect: inspector.inspect } : undefined);
  const input = new InputManager();

  const worldContainer = new Container();
  const starContainer = new Container();
  const terrainContainer = new Container();
  const entityContainer = new Container();
  const staticLanderContainer = new Container();
  const particleContainer = new Container();
  const foregroundTerrainContainer = new Container();
  const uiWorldContainer = new Container();

  app.stage.addChild(starContainer);
  app.stage.addChild(worldContainer);
  worldContainer.addChild(terrainContainer);
  worldContainer.addChild(staticLanderContainer);
  worldContainer.addChild(entityContainer);
  worldContainer.addChild(particleContainer);
  worldContainer.addChild(foregroundTerrainContainer);
  worldContainer.addChild(uiWorldContainer);

  const starfield = createStarfield(app.screen.width, app.screen.height);
  starContainer.addChild(starfield);

  const earth = createEarth();
  earth.x = app.screen.width * 0.8;
  earth.y = app.screen.height * 0.15;
  starContainer.addChild(earth);

  const terrain = createTerrainSystem();
  const foregroundVisualLayer = terrain.layers.at(-1);
  for (const layer of terrain.layers.slice(0, -1)) {
    terrainContainer.addChild(layer.container);
  }
  if (foregroundVisualLayer) {
    foregroundTerrainContainer.addChild(foregroundVisualLayer.container);
  }
  uiWorldContainer.addChild(terrain.landingZoneMarkers);

  let vehicle: Vehicle | null = null;
  let lastWireframe = tuning.wireframe;
  let lastForegroundJaggedness = tuning.foregroundJaggedness;

  function applyRenderMode(force = false) {
    const jaggednessChanged = lastForegroundJaggedness !== tuning.foregroundJaggedness;
    if (!force && lastWireframe === tuning.wireframe && !jaggednessChanged) return;
    lastWireframe = tuning.wireframe;
    lastForegroundJaggedness = tuning.foregroundJaggedness;

    if (force || jaggednessChanged) {
      terrain.visualForegroundHeights = generateVisualForegroundHeightmap(
        TERRAIN_TOTAL_WIDTH,
        terrain.foregroundHeights,
        tuning.foregroundJaggedness
      );
      const foregroundVisualLayer = terrain.layers.at(-1);
      if (foregroundVisualLayer) {
        foregroundVisualLayer.heights = terrain.visualForegroundHeights;
      }
    }

    starContainer.visible = !tuning.wireframe;
    app.renderer.background.color = tuning.wireframe ? 0x000000 : 0x0a0a14;
    redrawTerrainSystem(terrain);
    buildStaticLanders();

    if (vehicle) {
      drawLanderGraphics(vehicle.landerGfx);
      drawRoverGraphics(vehicle.roverGfx);
    }
  }

  const world: RAPIER.World = createWorld();
  createTerrainCollider(world, terrain.surfaceHeights);

  const camera = createCamera(app.screen.width, app.screen.height);
  const particles = new ParticleSystem();
  particleContainer.addChild(particles.container);

  let accumulator = 0;
  applyRenderMode(true);

  interface StarterBoostState {
    burnRemaining: number;
  }
  let starterBoost: StarterBoostState | null = null;

  let landingTween: gsap.core.Tween | null = null;

  function getLandingTarget(missionIndex: number): { x: number; y: number } {
    const mission = missions[missionIndex];
    const x = mission.terrain.landingZoneX + mission.terrain.landingZoneWidth / 2;
    const y = getTerrainHeightAt(terrain.foregroundHeights, x);
    return { x, y };
  }

  function getManualBrowseTarget(position: number): { x: number; y: number } {
    const first = getLandingTarget(0);
    const last = getLandingTarget(missions.length - 1);
    const x = first.x + (last.x - first.x) * position;
    const y = getTerrainHeightAt(terrain.foregroundHeights, x) - 26;
    return { x, y };
  }

  function updateManualMissionInView() {
    const context = actor.getSnapshot().context;
    let visibleMission: number | null = null;
    let closest = Infinity;

    for (let i = 0; i < missions.length; i++) {
      const target = getLandingTarget(i);
      const screenFraction =
        0.5 + ((target.x * PIXELS_PER_METER - camera.x) * camera.zoom) / camera.screenWidth;
      if (screenFraction < 0.25 || screenFraction > 0.75) continue;
      const distance = Math.abs(screenFraction - 0.5);
      if (distance < closest) {
        closest = distance;
        visibleMission = i;
      }
    }

    if (
      visibleMission !== context.currentMission ||
      context.manualMissionInView !== (visibleMission != null)
    ) {
      actor.send({ type: "SET_MANUAL_MISSION", missionIndex: visibleMission });
    }
  }

  function buildStaticLanders() {
    staticLanderContainer.removeChildren();
    for (let i = 0; i < missions.length; i++) {
      const target = getLandingTarget(i);
      const lander = createLanderGraphics();
      lander.x = target.x * PIXELS_PER_METER;
      lander.y = (target.y - LANDER_HEIGHT / 2) * PIXELS_PER_METER;
      staticLanderContainer.addChild(lander);
    }
  }

  buildStaticLanders();
  staticLanderContainer.visible = false;

  function getMissionSpawn(missionIndex: number): { x: number; y: number } {
    const target = getLandingTarget(missionIndex);
    const previousTarget = missionIndex > 0 ? getLandingTarget(missionIndex - 1) : null;
    const nextTarget =
      missionIndex < missions.length - 1 ? getLandingTarget(missionIndex + 1) : null;
    const missionSpacing =
      previousTarget != null
        ? target.x - previousTarget.x
        : nextTarget != null
          ? nextTarget.x - target.x
          : 0;
    const x = target.x - (missionSpacing * missionIndex) / 6;
    // startAltitude is globally tunable so it can be experimented with.
    const y = getTerrainHeightAt(terrain.foregroundHeights, x) - tuning.startAltitude;
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
      mode: "lander",
      fuel: MAX_FUEL,
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
      const prevHalfHeight = vehicle.mode === "rover" ? ROVER_HEIGHT / 2 : LANDER_HEIGHT / 2;
      const nextHalfHeight = mode === "rover" ? ROVER_HEIGHT / 2 : LANDER_HEIGHT / 2;

      replaceVehicleCollider(world, vehicle.body, mode);
      body.setTranslation(
        {
          x: pos.x,
          y: pos.y + prevHalfHeight - nextHalfHeight,
        },
        true
      );
      body.setAngvel(0, true);
    }

    vehicle.mode = mode;
    vehicle.landerGfx.visible = mode === "lander";
    vehicle.roverGfx.visible = mode === "rover";
  }

  /**
   * Drop the rover onto the terrain directly below wherever the lander was,
   * sitting flat against the slope (chassis rotated to match) at the
   * suspension's rest ride height with zero velocity — so it settles in place
   * instead of dropping in and bouncing.
   */
  function placeRoverOnTerrain() {
    if (!vehicle) return;
    const body = vehicle.body.rigidBody;
    const x = body.translation().x;
    const heights = terrain.surfaceHeights;
    const surfaceY = getTerrainHeightAt(heights, x);
    const leftH = getTerrainHeightAt(heights, x - 2);
    const rightH = getTerrainHeightAt(heights, x + 2);
    const slope = Math.atan2(rightH - leftH, 4);

    // Resting suspension compression under the rover's own weight, so the
    // wheels spawn already loaded and the chassis doesn't drop.
    const mass = body.mass();
    const restCompression = Math.min(
      tuning.roverSuspensionLength,
      (mass * Math.abs(tuning.gravity)) / 2 / tuning.roverSuspensionSpring
    );
    const rideHeight = ROVER_HEIGHT * 0.2 + (tuning.roverSuspensionLength - restCompression);

    // Offset the chassis centre along the surface normal (chassis "up").
    const upX = Math.sin(slope);
    const upY = -Math.cos(slope);

    body.setRotation(slope, true);
    body.setTranslation({ x: x + upX * rideHeight, y: surfaceY + upY * rideHeight }, true);
    body.setLinvel({ x: 0, y: 0 }, true);
    body.setAngvel(0, true);
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
    setVehicleMode("lander");
  }

  function boostLanderFromGround() {
    if (!vehicle) return;
    const body = vehicle.body.rigidBody;
    const pos = body.translation();
    const vel = body.linvel();
    const terrainH = getTerrainHeightAt(terrain.surfaceHeights, pos.x);
    body.setTranslation(
      {
        x: pos.x,
        y: terrainH - LANDER_HEIGHT / 2 - RETURN_TO_LANDER_CLEARANCE,
      },
      true
    );
    body.setRotation(0, true);
    body.setLinvel({ x: vel.x, y: Math.min(vel.y, -RETURN_TO_LANDER_BOOST_SPEED) }, true);
    body.setAngvel(0, true);
    applyThrust(body, RETURN_TO_LANDER_BOOST_IMPULSE, { x: 0, y: -1 });
    vehicle.thrustLevel = 1;
  }

  function startSimulatedLanding(missionIndex: number) {
    if (!vehicle) spawnVehicle(missionIndex);
    if (!vehicle) return;

    const target = getLandingTarget(missionIndex);
    const body = vehicle.body.rigidBody;
    const startY = target.y - LANDER_HEIGHT / 2 - 45;
    const endY = target.y - LANDER_HEIGHT / 2;
    vehicle.destroyed = false;
    vehicle.thrustLevel = 1;
    setVehicleMode("lander");

    body.setTranslation({ x: target.x, y: startY }, true);
    body.setLinvel({ x: 0, y: 0 }, true);
    body.setAngvel(0, true);
    body.setRotation(0, true);

    const pos = { x: target.x, y: startY };

    if (landingTween) landingTween.kill();
    landingTween = gsap.to(pos, {
      y: endY,
      duration: 1.5,
      ease: "expo.out",
      onUpdate: () => {
        if (!vehicle) return;
        const body = vehicle.body.rigidBody;
        body.setTranslation({ x: pos.x, y: pos.y }, true);
        body.setLinvel({ x: 0, y: 0 }, true);
        body.setAngvel(0, true);
        body.setRotation(0, true);
        vehicle.thrustLevel = 1;
        syncVehicleGraphics();
      },
      onComplete: () => {
        landingTween = null;
        if (vehicle) vehicle.thrustLevel = 0;
        placeVehicleLanded(actor.getSnapshot().context.currentMission);
        actor.send({
          type: "LANDED",
          missionIndex: actor.getSnapshot().context.currentMission,
        });
      },
    });
  }

  function syncVehicleGraphics() {
    if (!vehicle) return;
    const pos = vehicle.body.rigidBody.translation();
    const rot = vehicle.body.rigidBody.rotation();
    const ppm = PIXELS_PER_METER;

    const gfx = vehicle.mode === "lander" ? vehicle.landerGfx : vehicle.roverGfx;
    gfx.x = pos.x * ppm;
    gfx.y = pos.y * ppm;
    gfx.rotation = rot;

    for (const container of [vehicle.landerGfx, vehicle.roverGfx]) {
      const debugBounds = container.children.find((c) => c.label === "debugColliderBounds");
      if (debugBounds) {
        debugBounds.visible = tuning.wireframe || tuning.showDebugBounds;
      }
    }

    if (vehicle.mode === "lander") {
      const glow = vehicle.landerGfx.children.find((c) => c.label === "engineGlow");
      if (glow) glow.alpha = vehicle.thrustLevel * 0.6;
    } else {
      syncRoverGraphics({
        ...(vehicle as unknown as Rover),
        container: vehicle.roverGfx,
      });
    }
  }

  function startMissionBoost() {
    if (!vehicle) return;
    starterBoost = null;
    setVehicleMode("lander");
    const body = vehicle.body.rigidBody;
    const pos = body.translation();
    const terrainH = getTerrainHeightAt(terrain.surfaceHeights, pos.x);
    body.setTranslation({ x: pos.x, y: terrainH - LANDER_HEIGHT / 2 - 0.75 }, true);
    body.setLinvel({ x: 1.5, y: -1.5 }, true);
    body.setAngvel(0, true);
    body.setRotation(tuning.starterLaunchAngle, true);
    starterBoost = { burnRemaining: tuning.starterEngineBurnSeconds };
  }

  function crashVehicle(pos: { x: number; y: number }) {
    if (!vehicle || vehicle.destroyed) return;
    starterBoost = null;
    vehicle.destroyed = true;
    vehicle.body.rigidBody.setLinvel({ x: 0, y: 0 }, true);
    vehicle.body.rigidBody.setAngvel(0, true);
    vehicle.body.rigidBody.setRotation(0, true);
    particles.emitExplosion(pos.x, pos.y);
    vehicle.landerGfx.visible = false;
    actor.send({ type: "CRASHED" });
  }

  function isLanderTouchingTerrain() {
    if (!vehicle) return false;
    return getLanderTerrainContact().touching;
  }

  function getLanderTerrainContact() {
    if (!vehicle) return { touching: false, upperContact: false };
    const pos = vehicle.body.rigidBody.translation();
    const rot = vehicle.body.rigidBody.rotation();
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const halfW = LANDER_WIDTH / 2;
    const halfH = LANDER_HEIGHT / 2;
    const corners = [
      { x: -halfW, y: -halfH, upper: true },
      { x: halfW, y: -halfH, upper: true },
      { x: -halfW, y: halfH, upper: false },
      { x: halfW, y: halfH, upper: false },
    ];

    let touching = false;
    let upperContact = false;
    for (const corner of corners) {
      const x = pos.x + cos * corner.x - sin * corner.y;
      const y = pos.y + sin * corner.x + cos * corner.y;
      const terrainH = getTerrainHeightAt(terrain.surfaceHeights, x);
      if (y >= terrainH - 0.25) {
        touching = true;
        upperContact ||= corner.upper;
      }
    }
    return { touching, upperContact };
  }

  function checkContactAndLanding(impactSpeed?: number) {
    if (!vehicle || vehicle.destroyed) return;

    const state = actor.getSnapshot();
    if (!state.matches({ playing: "descending" })) return;

    // contactPairsWith is broad-phase, so use an altitude check against the
    // terrain to detect actual ground contact.
    const pos = vehicle.body.rigidBody.translation();
    const vel = vehicle.body.rigidBody.linvel();
    const angle = vehicle.body.rigidBody.rotation();
    const speed = Math.hypot(vel.x, vel.y);
    const absAngle = Math.abs(angle % (Math.PI * 2));
    const normalizedAngle = absAngle > Math.PI ? Math.PI * 2 - absAngle : absAngle;
    const contact = getLanderTerrainContact();
    if (!contact.touching) return;

    if (
      (impactSpeed ?? speed) > tuning.maxLandingSpeed ||
      contact.upperContact ||
      normalizedAngle > tuning.maxLandingAngle
    ) {
      crashVehicle(pos);
      return;
    }

    const missionIndex = missions.findIndex((mission) => {
      const { landingZoneX, landingZoneWidth } = mission.terrain;
      return pos.x >= landingZoneX && pos.x <= landingZoneX + landingZoneWidth;
    });
    const result =
      missionIndex === -1
        ? { type: "missed" as const }
        : checkLanding(
            vehicle as unknown as Lander,
            missions[missionIndex].terrain.landingZoneX,
            missions[missionIndex].terrain.landingZoneWidth
          );

    if (!result) return;

    if (result.type === "crashed") {
      crashVehicle(pos);
    } else if (result.type === "missed") {
      starterBoost = null;
      actor.send({ type: "MISSED" });
    } else {
      particles.emitDust(pos.x, pos.y);
      vehicle.body.rigidBody.setLinvel({ x: 0, y: 0 }, true);
      vehicle.body.rigidBody.setAngvel(0, true);
      actor.send({ type: "LANDED", missionIndex });
    }
  }

  function updateGrounded() {
    if (!vehicle) return;
    const pos = vehicle.body.rigidBody.translation();
    const terrainH = getTerrainHeightAt(terrain.surfaceHeights, pos.x);
    const halfHeight = vehicle.mode === "rover" ? ROVER_HEIGHT / 2 : LANDER_HEIGHT / 2;
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
    const playing = typeof v === "object" && "playing" in v ? ((v as any).playing as string) : null;

    if (playing === prevPlayingState) return;
    const prev = prevPlayingState;
    prevPlayingState = playing;

    // Left the playing region (title/manual/etc). Reset so the next entry is
    // treated as a fresh launch.
    if (playing === null) return;

    const resumingFromPause =
      prev === "paused" && playing !== "simulatingLanding" && !state.context.restartRequested;
    if (resumingFromPause) return; // history resume — keep everything as-is

    switch (playing) {
      case "descending":
        if (state.context.restartRequested) {
          accumulator = 0;
          starterBoost = null;
          spawnVehicle(state.context.currentMission);
          actor.send({ type: "RESTARTED" });
          break;
        }

        if (prev === "landed" || prev === "rover") {
          // Continue/return keeps the same body and hands control back
          // immediately in the normal descending state.
          if (vehicle) {
            vehicle.fuel = MAX_FUEL;
            vehicle.destroyed = false;
            setVehicleMode("lander");
            if (prev === "landed") {
              startMissionBoost();
            } else {
              boostLanderFromGround();
            }
          }
        } else {
          // Fresh launch / retry.
          accumulator = 0;
          starterBoost = null;
          spawnVehicle(state.context.currentMission);
        }
        break;

      case "rover":
        // Same entity — swap behaviour, then drop it onto the terrain right
        // where the lander was, flat against the slope.
        setVehicleMode("rover");
        placeRoverOnTerrain();
        break;

      case "landed":
        setVehicleMode("lander");
        break;

      case "simulatingLanding":
        startSimulatedLanding(state.context.currentMission);
        break;

      case "crashed":
      case "missed":
      case "paused":
        break;
    }
  });

  input.setKonamiCallback(() => {
    actor.send({ type: "KONAMI" });
  });

  input.setAnyControlCallback(() => {
    const state = actor.getSnapshot();
    if (state.matches("manual")) {
      actor.send({ type: "CONTROLS_PRESSED" });
    }
  });

  input.setEscapeCallback(() => {
    const state = actor.getSnapshot();
    if (state.matches({ playing: "paused" })) {
      actor.send({ type: "RESUME" });
    } else if (
      state.matches({ playing: "descending" }) ||
      state.matches({ playing: "rover" }) ||
      state.matches({ playing: "simulatingLanding" })
    ) {
      actor.send({ type: "PAUSE" });
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
      type: "UPDATE_TELEMETRY",
      velocity: { x: vel.x, y: vel.y },
      altitude: Math.max(0, altitude),
      angle: vehicle.body.rigidBody.rotation(),
      fuel: vehicle.fuel,
      thrustLevel: vehicle.thrustLevel,
    });
  }

  app.ticker.add((ticker) => {
    applyRenderMode();

    const state = actor.getSnapshot();
    const isLanded = state.matches({ playing: "landed" });

    // Fade landing-zone indicators out as the lander closes in.
    if (vehicle && !vehicle.destroyed) {
      const t = vehicle.body.rigidBody.translation();
      updateLandingZoneProximity(
        terrain,
        state.context.currentMission,
        t.x,
        t.y,
        camera.zoom,
        isLanded
      );
    } else {
      updateLandingZoneProximity(
        terrain,
        state.context.currentMission,
        null,
        null,
        camera.zoom,
        isLanded
      );
    }

    // Clamp delta so a long stall (e.g. backgrounded tab) can't spiral physics.
    const delta = Math.min(ticker.deltaMS / 1000, 0.05);

    const playing =
      typeof state.value === "object" && "playing" in state.value
        ? ((state.value as any).playing as string)
        : null;

    if (playing === "descending" && vehicle && !vehicle.destroyed) {
      world.gravity = { x: 0, y: tuning.gravity };
      accumulator += delta;
      while (accumulator >= FIXED_TIMESTEP) {
        updateLanderPhysics(vehicle as unknown as Lander, input.state, FIXED_TIMESTEP);
        if (starterBoost && starterBoost.burnRemaining > 0) {
          applyThrust(vehicle.body.rigidBody, tuning.starterLaunchForce * FIXED_TIMESTEP, {
            x: 0,
            y: -1,
          });
          vehicle.thrustLevel = 1;
          vehicle.fuel = Math.max(0, vehicle.fuel - tuning.fuelBurnMain * FIXED_TIMESTEP);
          starterBoost.burnRemaining -= FIXED_TIMESTEP;
          if (starterBoost.burnRemaining <= 0) {
            starterBoost = null;
          }
        }
        const preStepVel = vehicle.body.rigidBody.linvel();
        const preStepPos = vehicle.body.rigidBody.translation();
        const impactSpeed = Math.hypot(preStepVel.x, preStepVel.y);
        const terrainH = getTerrainHeightAt(terrain.surfaceHeights, preStepPos.x);
        const predictedBottomY = preStepPos.y + LANDER_HEIGHT / 2 + preStepVel.y * FIXED_TIMESTEP;
        const willHitFast =
          impactSpeed > tuning.maxLandingSpeed && predictedBottomY >= terrainH - 0.25;
        world.step();
        accumulator -= FIXED_TIMESTEP;
        if (willHitFast) {
          crashVehicle(vehicle.body.rigidBody.translation());
          break;
        }
        if (isLanderTouchingTerrain()) {
          checkContactAndLanding(impactSpeed);
          if (vehicle.destroyed || !actor.getSnapshot().matches({ playing: "descending" })) {
            break;
          }
        }
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
    } else if (playing === "rover" && vehicle) {
      world.gravity = { x: 0, y: tuning.gravity };
      accumulator += delta;
      while (accumulator >= FIXED_TIMESTEP) {
        updateRoverPhysics(vehicle as unknown as Rover, input.state, FIXED_TIMESTEP, world);
        world.step();
        accumulator -= FIXED_TIMESTEP;
      }
      syncVehicleGraphics();

      telemetryTimer += delta;
      if (telemetryTimer >= TELEMETRY_INTERVAL) {
        telemetryTimer = 0;
        sendTelemetry();
      }
    } else if (playing === "simulatingLanding") {
      // GSAP tween drives position; just sync graphics + emit particles
      if (vehicle) {
        syncVehicleGraphics();
        particleTimer += delta;
        if (particleTimer >= 0.03) {
          emitLanderParticles(vehicle as unknown as Lander, particles);
          particleTimer = 0;
        }
      }
    } else if (vehicle) {
      // landed / crashed / missed / paused: hold position, keep graphics synced.
      syncVehicleGraphics();
    }

    applyCamera(state, playing);
  });

  function applyCamera(state: any, playing: string | null) {
    staticLanderContainer.visible = state.matches?.("manual") === true;

    if (state.matches?.("manual")) {
      const target = getManualBrowseTarget(state.context.browsePosition);
      focusCamera(camera, target.x, target.y, MANUAL_CAMERA_ZOOM, 0.5, 0.58);
      updateManualMissionInView();
    } else if (vehicle && !vehicle.destroyed) {
      const pos = vehicle.body.rigidBody.translation();
      if (playing === "rover") {
        focusCamera(camera, pos.x, pos.y, 2.2, 0.5, 0.56);
      } else if (playing === "landed") {
        focusCamera(camera, pos.x, pos.y, LANDED_CAMERA_ZOOM, 1 / 3, 0.58);
      } else {
        const target = getLandingTarget(state.context.currentMission);
        frameCamera(camera, pos.x, pos.y, target.x, target.y);
      }
    }

    const sw = app.screen.width;
    const sh = app.screen.height;

    worldContainer.scale.set(camera.zoom);
    worldContainer.x = sw / 2 - camera.x * camera.zoom;
    worldContainer.y = sh / 2 - camera.y * camera.zoom;

    // parallax — background layers (pf<1) move slower than the camera.
    for (const layer of terrain.layers) {
      const pf = layer.parallaxFactor;
      layer.container.x = (layer.xOffset ?? 0) + camera.x * (1 - pf);
    }

    starContainer.x = -camera.x * 0.02;
    starContainer.y = -camera.y * 0.02;
  }

  function handleResize() {
    camera.screenWidth = window.innerWidth;
    camera.screenHeight = window.innerHeight;
  }

  window.addEventListener("resize", handleResize);

  onProgress?.(1.0);

  actor.start();

  return {
    app,
    actor,
    input,
    destroy() {
      actor.stop();
      input.destroy();
      window.removeEventListener("resize", handleResize);
      starterBoost = null;
      if (landingTween) {
        landingTween.kill();
        landingTween = null;
      }
      particles.destroy();
      app.destroy(true);
    },
  };
}
