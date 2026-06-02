import { MAX_LANDING_SPEED, MAX_LANDING_ANGLE, MOON_GRAVITY } from "./constants";

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
  sideEngineTorque: 70000,
  fuelBurnMain: 3,
  fuelBurnSide: 1,

  // Mission / landing
  startAltitude: 150,
  maxLandingSpeed: MAX_LANDING_SPEED,
  maxLandingAngle: MAX_LANDING_ANGLE,

  // Rover — forces in newtons (rover mass ~210kg), except *Speed (m/s) and
  // roverGrip (m/s^2 of braking). See updateRoverPhysics for the model.
  roverAccel: 4200,
  roverMaxSpeed: 34,
  roverGrip: 9,
  roverAirTorque: 700,
  roverDownforce: 600,
  roverBoostForce: 18000,
  roverBoostFuelBurn: 3.5,
  roverWheelSpinSpeed: 14,
  roverSuspensionLength: 1.4,
  roverSuspensionSpring: 3000,
  roverSuspensionDamping: 900,
  roverSuspensionMaxForce: 4000,

  // Misc
  starterLaunchForce: 120000,
  starterEngineBurnSeconds: 1.15,
  starterLaunchAngle: 0.06,
  foregroundJaggedness: 1,
  wireframe: false,
  showDebugBounds: false,
};

export type Tuning = typeof tuning;
