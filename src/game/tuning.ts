import {
  MAX_LANDING_SPEED,
  MAX_LANDING_ANGLE,
  MOON_GRAVITY,
} from './constants';

/**
 * Live-tweakable game parameters. The engine reads from this object every frame
 * (rather than from constants directly), so a leva panel can mutate it in place
 * and changes take effect immediately. `startAltitude` only applies on the next
 * (re)launch.
 *
 * Force/torque values are impulse magnitudes scaled by dt; with the Apollo LM
 * mass the main engine TWR is roughly mainEngineForce / (mass * gravity).
 */
export const tuning = {
  // Physics
  gravity: MOON_GRAVITY,
  mainEngineForce: 45000,
  sideEngineTorque: 42000,
  fuelBurnMain: 4.75,
  fuelBurnSide: 1.15,

  // Mission / landing
  startAltitude: 150,
  maxLandingSpeed: MAX_LANDING_SPEED,
  maxLandingAngle: MAX_LANDING_ANGLE,

  // Rover
  roverAccel: 24,
  roverMaxSpeed: 20,
  roverAirTorque: 140,
  roverDownforce: 700,
  roverBoostForce: 620,
  roverWheelSpinSpeed: 14,
  roverSuspensionLength: 1.35,
  roverSuspensionSpring: 6500,
  roverSuspensionDamping: 5200,
  roverSuspensionMaxForce: 3500,

  // Misc
  starterLaunchForce: 120000,
  starterEngineBurnSeconds: 1.15,
  starterLaunchAngle: 0.06,
  foregroundJaggedness: 1,
  wireframe: false,
  showDebugBounds: false,
};

export type Tuning = typeof tuning;
