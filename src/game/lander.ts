import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import landerSvgUrl from '../data/Lander.svg?url';
import {
  LANDER_WIDTH,
  LANDER_HEIGHT,
  PIXELS_PER_METER,
  MAX_FUEL,
} from './constants';
import { tuning } from './tuning';
import type { LanderBody } from './physics';
import { applyThrust, applyTorque } from './physics';
import type { InputState } from './input';
import type { ParticleSystem } from './particles';

const WIREFRAME_COLOR = 0xffffff;
const LANDER_SVG_ASPECT = 753 / 695;
let landerTexture: Texture | null = null;

export async function loadLanderGraphics() {
  landerTexture = await Assets.load<Texture>(landerSvgUrl);
}

export interface Lander {
  container: Container;
  body: LanderBody;
  fuel: number;
  thrustLevel: number;
  leftEngineOn: boolean;
  rightEngineOn: boolean;
  mainEngineOn: boolean;
  destroyed: boolean;
}

export function createLanderGraphics(): Container {
  const container = new Container();
  drawLanderGraphics(container);
  return container;
}

export function drawLanderGraphics(container: Container) {
  container.removeChildren();
  const ppm = PIXELS_PER_METER;
  const hw = (LANDER_WIDTH / 2) * ppm;
  const hh = (LANDER_HEIGHT / 2) * ppm;
  const sprite = new Sprite(landerTexture ?? Texture.WHITE);
  sprite.anchor.set(0.5);
  sprite.height = hh * 2;
  sprite.width = sprite.height * LANDER_SVG_ASPECT;
  sprite.label = 'landerSprite';
  container.addChild(sprite);

  // engine glow (hidden by default)
  const glow = new Graphics();
  glow.circle(0, hh * 0.8, hw * 0.6);
  glow.fill({ color: 0xffcc00, alpha: 0.3 });
  glow.label = 'engineGlow';
  glow.alpha = 0;
  container.addChild(glow);

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

export function createLander(body: LanderBody): Lander {
  return {
    container: createLanderGraphics(),
    body,
    fuel: MAX_FUEL,
    thrustLevel: 0,
    leftEngineOn: false,
    rightEngineOn: false,
    mainEngineOn: false,
    destroyed: false,
  };
}

export function updateLanderPhysics(
  lander: Lander,
  input: InputState,
  dt: number,
) {
  if (lander.destroyed) return;

  lander.leftEngineOn = input.left > 0;
  lander.rightEngineOn = input.right > 0;
  lander.mainEngineOn = input.up > 0;

  let fuelUsed = 0;

  if (lander.fuel > 0) {
    const torqueInput = input.right - input.left;
    if (torqueInput !== 0) {
      applyTorque(
        lander.body.rigidBody,
        torqueInput * tuning.sideEngineTorque * dt,
      );
      fuelUsed +=
        Math.min(1, Math.abs(torqueInput)) * tuning.fuelBurnSide * dt;
    }
  }

  if (lander.mainEngineOn && lander.fuel > 0) {
    const thrust = Math.min(1, input.up);
    applyThrust(lander.body.rigidBody, tuning.mainEngineForce * thrust * dt, {
      x: 0,
      y: -1,
    });
    fuelUsed += tuning.fuelBurnMain * thrust * dt;
    lander.thrustLevel = thrust;
  } else {
    lander.thrustLevel = 0;
  }

  lander.fuel = Math.max(0, lander.fuel - fuelUsed);
}

export function syncLanderGraphics(lander: Lander) {
  const pos = lander.body.rigidBody.translation();
  const rot = lander.body.rigidBody.rotation();
  const ppm = PIXELS_PER_METER;

  lander.container.x = pos.x * ppm;
  lander.container.y = pos.y * ppm;
  lander.container.rotation = rot;

  const glow = lander.container.children.find((c) => c.label === 'engineGlow');
  if (glow) {
    glow.alpha = lander.thrustLevel * 0.6;
  }
}

export function emitLanderParticles(
  lander: Lander,
  particles: ParticleSystem,
) {
  if (lander.destroyed || lander.thrustLevel === 0) return;

  const pos = lander.body.rigidBody.translation();
  const rot = lander.body.rigidBody.rotation();
  const hh = LANDER_HEIGHT / 2;

  const nozzleX = pos.x - Math.sin(rot) * hh;
  const nozzleY = pos.y + Math.cos(rot) * hh;

  particles.emitThrust(nozzleX, nozzleY, rot, lander.thrustLevel);
}

export interface LandingResult {
  type: 'landed' | 'crashed' | 'missed';
}

export function checkLanding(
  lander: Lander,
  landingZoneX: number,
  landingZoneWidth: number,
): LandingResult | null {
  const pos = lander.body.rigidBody.translation();
  const vel = lander.body.rigidBody.linvel();
  const angle = lander.body.rigidBody.rotation();

  const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
  const absAngle = Math.abs(angle % (Math.PI * 2));
  const normalizedAngle = absAngle > Math.PI ? Math.PI * 2 - absAngle : absAngle;

  const isInZone =
    pos.x >= landingZoneX && pos.x <= landingZoneX + landingZoneWidth;

  if (speed > tuning.maxLandingSpeed) {
    return { type: 'crashed' };
  }

  if (normalizedAngle > tuning.maxLandingAngle) {
    return { type: 'crashed' };
  }

  if (!isInZone) {
    return { type: 'missed' };
  }

  return { type: 'landed' };
}
