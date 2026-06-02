import { MAX_LANDING_SPEED, MAX_LANDING_ANGLE } from './constants';

/**
 * Live-tweakable game parameters. The engine reads from this object every frame
 * (rather than from constants directly), so a leva panel can mutate it in place
 * and changes take effect immediately. `startAltitude` only applies on the next
 * (re)launch.
 *
 * Force/torque values are impulse magnitudes scaled by dt; with the lander body
 * mass (~40kg) the engine TWR is roughly mainEngineForce / (40 * gravity).
 */
export const tuning = {
  // Physics
  gravity: 1.62,
  mainEngineForce: 130,
  sideEngineTorque: 120,
  fuelBurnMain: 2,
  fuelBurnSide: 1,

  // Mission / landing
  startAltitude: 150,
  maxLandingSpeed: MAX_LANDING_SPEED,
  maxLandingAngle: MAX_LANDING_ANGLE,

  // Rover
  roverAccel: 360,
  roverMaxSpeed: 24,
  roverAirTorque: 140,
  roverDownforce: 120,
  roverBoostForce: 500,
  roverWheelSpinSpeed: 14,
  roverSuspensionLength: 1.0,
  roverSuspensionSpring: 520,
  roverSuspensionDamping: 220,
  roverSuspensionMaxForce: 900,

  // Misc
  transitLaunchForce: 650,
  transitEngineBurnSeconds: 0.8,
  transitLaunchAngle: 0.35,
  transitPlayableAltitude: 50,
  transitMaxHorizontalSpeed: 10,
  transitHandOffDistance: 120,
  transitHandOffVerticalSpeed: 14,
  transitMaxSeconds: 20,
  showDebugBounds: false,
};

export type Tuning = typeof tuning;
