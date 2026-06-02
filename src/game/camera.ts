import {
  CAMERA_LERP_SPEED,
  CAMERA_PADDING_X,
  CAMERA_PADDING_Y,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_LERP_SPEED,
  PIXELS_PER_METER,
} from './constants';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  screenWidth: number;
  screenHeight: number;
}

export function createCamera(screenWidth: number, screenHeight: number): Camera {
  return {
    x: 0,
    y: 0,
    zoom: ZOOM_MIN,
    targetX: 0,
    targetY: 0,
    targetZoom: ZOOM_MIN,
    screenWidth,
    screenHeight,
  };
}

/**
 * Frame the camera so that both points of interest — the lander and the
 * landing-zone target — stay inside the viewport, with padding. Zoom is
 * derived from the bounding box of the two points and clamped.
 */
export function frameCamera(
  camera: Camera,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2;

  // Half-extents (meters) the viewport must cover to contain both points.
  const halfW = Math.abs(ax - bx) / 2 + CAMERA_PADDING_X;
  const halfH = Math.abs(ay - by) / 2 + CAMERA_PADDING_Y;

  const zoomX = camera.screenWidth / 2 / (halfW * PIXELS_PER_METER);
  const zoomY = camera.screenHeight / 2 / (halfH * PIXELS_PER_METER);
  const targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(zoomX, zoomY)));

  camera.targetZoom = targetZoom;
  camera.zoom += (targetZoom - camera.zoom) * ZOOM_LERP_SPEED;

  const targetPixelX = midX * PIXELS_PER_METER;
  const targetPixelY = midY * PIXELS_PER_METER;
  camera.targetX = targetPixelX;
  camera.targetY = targetPixelY;
  camera.x += (targetPixelX - camera.x) * CAMERA_LERP_SPEED;
  camera.y += (targetPixelY - camera.y) * CAMERA_LERP_SPEED;
}

export function focusCamera(
  camera: Camera,
  worldX: number,
  worldY: number,
  targetZoom: number,
  anchorX = 0.5,
  anchorY = 0.5,
) {
  camera.targetZoom = Math.max(ZOOM_MIN, Math.min(targetZoom, 8));
  camera.zoom += (camera.targetZoom - camera.zoom) * ZOOM_LERP_SPEED;

  const px = worldX * PIXELS_PER_METER;
  const py = worldY * PIXELS_PER_METER;
  const targetPixelX = px - (anchorX - 0.5) * camera.screenWidth / camera.targetZoom;
  const targetPixelY = py - (anchorY - 0.5) * camera.screenHeight / camera.targetZoom;

  camera.targetX = targetPixelX;
  camera.targetY = targetPixelY;
  camera.x += (targetPixelX - camera.x) * CAMERA_LERP_SPEED;
  camera.y += (targetPixelY - camera.y) * CAMERA_LERP_SPEED;
}

export function setCameraFramed(
  camera: Camera,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  // Snap (no lerp) — used when (re)spawning so the first frame is composed.
  frameCamera(camera, ax, ay, bx, by);
  camera.x = camera.targetX;
  camera.y = camera.targetY;
  camera.zoom = camera.targetZoom;
}

export function worldToScreen(
  camera: Camera,
  worldX: number,
  worldY: number,
): { x: number; y: number } {
  const px = worldX * PIXELS_PER_METER;
  const py = worldY * PIXELS_PER_METER;
  return {
    x: (px - camera.x) * camera.zoom + camera.screenWidth / 2,
    y: (py - camera.y) * camera.zoom + camera.screenHeight / 2,
  };
}
