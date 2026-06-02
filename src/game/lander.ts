import { Container, Graphics } from 'pixi.js';
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
  const wireframe = tuning.wireframe;

  function finish(g: Graphics, color: number) {
    if (wireframe) {
      g.stroke({ color: WIREFRAME_COLOR, width: 2 });
    } else {
      g.fill({ color });
    }
  }

  // body
  const body = new Graphics();
  body.roundRect(-hw * 0.6, -hh * 0.5, hw * 1.2, hh * 1.0, 4);
  finish(body, 0xcccccc);
  body.roundRect(-hw * 0.4, -hh * 0.9, hw * 0.8, hh * 0.5, 3);
  finish(body, 0xaaaaaa);
  container.addChild(body);

  // window
  const window = new Graphics();
  window.circle(0, -hh * 0.5, hw * 0.2);
  finish(window, 0x222222);
  window.circle(0, -hh * 0.5, hw * 0.15);
  finish(window, 0x334455);
  container.addChild(window);

  // legs
  const legs = new Graphics();
  legs.moveTo(-hw * 0.5, hh * 0.5);
  legs.lineTo(-hw * 0.9, hh);
  legs.lineTo(-hw * 1.1, hh);
  legs.moveTo(hw * 0.5, hh * 0.5);
  legs.lineTo(hw * 0.9, hh);
  legs.lineTo(hw * 1.1, hh);
  legs.stroke({ color: wireframe ? WIREFRAME_COLOR : 0xcc8800, width: 2 });
  container.addChild(legs);

  // foot pads
  const pads = new Graphics();
  pads.circle(-hw, hh, 4);
  finish(pads, 0xcc8800);
  pads.circle(hw, hh, 4);
  finish(pads, 0xcc8800);
  container.addChild(pads);

  // nozzle
  const nozzle = new Graphics();
  nozzle.moveTo(-hw * 0.3, hh * 0.5);
  nozzle.lineTo(-hw * 0.4, hh * 0.7);
  nozzle.lineTo(hw * 0.4, hh * 0.7);
  nozzle.lineTo(hw * 0.3, hh * 0.5);
  finish(nozzle, 0x888888);
  container.addChild(nozzle);

  // engine glow (hidden by default)
  const glow = new Graphics();
  glow.circle(0, hh * 0.8, hw * 0.6);
  if (wireframe) {
    glow.stroke({ color: WIREFRAME_COLOR, width: 2, alpha: 0.7 });
  } else {
    glow.fill({ color: 0xffcc00, alpha: 0.3 });
  }
  glow.label = 'engineGlow';
  glow.alpha = 0;
  container.addChild(glow);

  const debugCollider = new Graphics();
  debugCollider.rect(-hw, -hh, hw * 2, hh * 2);
  debugCollider.stroke({
    color: wireframe ? WIREFRAME_COLOR : 0xff3355,
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

  lander.leftEngineOn = input.left;
  lander.rightEngineOn = input.right;
  lander.mainEngineOn = input.up;

  let fuelUsed = 0;

  if (lander.fuel > 0) {
    if (lander.leftEngineOn && !lander.rightEngineOn) {
      applyTorque(lander.body.rigidBody, -tuning.sideEngineTorque * dt);
      fuelUsed += tuning.fuelBurnSide * dt;
    }

    if (lander.rightEngineOn && !lander.leftEngineOn) {
      applyTorque(lander.body.rigidBody, tuning.sideEngineTorque * dt);
      fuelUsed += tuning.fuelBurnSide * dt;
    }
  }

  if (lander.mainEngineOn && lander.fuel > 0) {
    applyThrust(lander.body.rigidBody, tuning.mainEngineForce * dt, { x: 0, y: -1 });
    fuelUsed += tuning.fuelBurnMain * dt;
    lander.thrustLevel = 1;
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
