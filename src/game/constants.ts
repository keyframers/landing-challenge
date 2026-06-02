export const PIXELS_PER_METER = 10;
export const MOON_GRAVITY = 1.624;
export const FIXED_TIMESTEP = 1 / 60;

export const LANDER_WIDTH = 4;
export const LANDER_HEIGHT = 5;
export const LUNAR_MODULE_MASS = 15200;

export const MAX_LANDING_SPEED = 4;
export const MAX_LANDING_ANGLE = Math.PI / 12; // 15 degrees

export const MAIN_ENGINE_FORCE = 130;
export const SIDE_ENGINE_FORCE = 50;
export const SIDE_ENGINE_TORQUE = 80;
export const FUEL_BURN_RATE_MAIN = 2;
export const FUEL_BURN_RATE_SIDE = 1;
export const MAX_FUEL = 150;

export const CAMERA_LERP_SPEED = 0.15;

// Dynamic zoom: the camera frames both the lander and the landing zone, with
// this much world-space padding (meters) around them.
export const CAMERA_PADDING_X = 40;
export const CAMERA_PADDING_Y = 40;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 1.2;
export const ZOOM_LERP_SPEED = 0.1;

export const TERRAIN_TOTAL_WIDTH = 5000;
export const TERRAIN_SEGMENT_SIZE = 2;
export const TERRAIN_BASE_HEIGHT = 300;
export const TERRAIN_AMPLITUDE = 40;

export const STARFIELD_COUNT = 200;

export const ROVER_WIDTH = 3;
export const ROVER_HEIGHT = 1.5;
export const LUNAR_ROVER_MASS = 210;
export const ROVER_ACCEL = 30;
export const ROVER_MAX_SPEED = 15;
export const ROVER_AIR_TORQUE = 40;

export const TELEMETRY_HZ = 20;

export const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
  "Enter",
];
