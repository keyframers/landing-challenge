import { Graphics, Container } from 'pixi.js';
import { createNoise2D } from 'simplex-noise';
import {
  TERRAIN_TOTAL_WIDTH,
  TERRAIN_SEGMENT_SIZE,
  TERRAIN_BASE_HEIGHT,
  TERRAIN_AMPLITUDE,
  PIXELS_PER_METER,
} from './constants';
import { missions } from '../data/missions';
import { tuning } from './tuning';

const WIREFRAME_COLOR = 0xffffff;
const LUNAR_TOP = 0xd8dce2;
const LUNAR_MID = 0xaeb6c1;
const LUNAR_LOW = 0x6f7987;
const LUNAR_SHADOW = 0x323b48;
const ROCK_LIGHT = 0xc9cdd3;
const ROCK_DARK = 0x596372;

export interface TerrainLayer {
  container: Container;
  heights: number[];
  parallaxFactor: number;
}

export interface LandingZone {
  x: number;
  width: number;
  missionIndex: number;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateHeightmap(
  totalWidth: number,
  roughness: number,
  landingZones: LandingZone[],
  seed?: number,
): number[] {
  const noise2D = createNoise2D(seed != null ? seededRandom(seed * 2147483647) : undefined);
  const numPoints = Math.ceil(totalWidth / TERRAIN_SEGMENT_SIZE) + 1;
  const heights: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const x = i * TERRAIN_SEGMENT_SIZE;
    const nx = x / 600;

    let h =
      noise2D(nx * roughness, 0) * TERRAIN_AMPLITUDE +
      noise2D(nx * roughness * 2.5, 1.3) * (TERRAIN_AMPLITUDE * 0.4) +
      noise2D(nx * roughness * 5, 2.7) * (TERRAIN_AMPLITUDE * 0.15);

    heights.push(TERRAIN_BASE_HEIGHT + h);
  }

  for (const zone of landingZones) {
    const startIdx = Math.floor(zone.x / TERRAIN_SEGMENT_SIZE);
    const endIdx = Math.ceil((zone.x + zone.width) / TERRAIN_SEGMENT_SIZE);
    const zoneHeight = heights[Math.floor((startIdx + endIdx) / 2)] ?? TERRAIN_BASE_HEIGHT;

    for (let i = startIdx; i <= endIdx && i < heights.length; i++) {
      heights[i] = zoneHeight;
    }

    const blendRange = 10;
    for (let b = 1; b <= blendRange; b++) {
      const t = b / (blendRange + 1);
      const leftIdx = startIdx - b;
      const rightIdx = endIdx + b;
      if (leftIdx >= 0) {
        heights[leftIdx] =
          heights[leftIdx] * t + zoneHeight * (1 - t);
      }
      if (rightIdx < heights.length) {
        heights[rightIdx] =
          heights[rightIdx] * t + zoneHeight * (1 - t);
      }
    }
  }

  return heights;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampTerrainSlopes(heights: number[], maxSlopeRadians = Math.PI / 3) {
  const maxDelta = Math.tan(maxSlopeRadians) * TERRAIN_SEGMENT_SIZE;

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < heights.length; i++) {
      const delta = heights[i] - heights[i - 1];
      heights[i] = heights[i - 1] + clamp(delta, -maxDelta, maxDelta);
    }
    for (let i = heights.length - 2; i >= 0; i--) {
      const delta = heights[i] - heights[i + 1];
      heights[i] = heights[i + 1] + clamp(delta, -maxDelta, maxDelta);
    }
  }
}

function smoothHeights(heights: number[], passes = 2) {
  for (let pass = 0; pass < passes; pass++) {
    const next = heights.slice();
    for (let i = 1; i < heights.length - 1; i++) {
      next[i] = heights[i - 1] * 0.25 + heights[i] * 0.5 + heights[i + 1] * 0.25;
    }
    heights.splice(0, heights.length, ...next);
  }
}

function flattenLandingZones(heights: number[], landingZones: LandingZone[]) {
  for (const zone of landingZones) {
    const startIdx = Math.floor(zone.x / TERRAIN_SEGMENT_SIZE);
    const endIdx = Math.ceil((zone.x + zone.width) / TERRAIN_SEGMENT_SIZE);
    const zoneHeight =
      heights[Math.floor((startIdx + endIdx) / 2)] ?? TERRAIN_BASE_HEIGHT;

    for (let i = startIdx; i <= endIdx && i < heights.length; i++) {
      heights[i] = zoneHeight;
    }

    const blendRange = 10;
    for (let b = 1; b <= blendRange; b++) {
      const t = b / (blendRange + 1);
      const leftIdx = startIdx - b;
      const rightIdx = endIdx + b;
      if (leftIdx >= 0) {
        heights[leftIdx] = heights[leftIdx] * t + zoneHeight * (1 - t);
      }
      if (rightIdx < heights.length) {
        heights[rightIdx] = heights[rightIdx] * t + zoneHeight * (1 - t);
      }
    }
  }
}

function addRoverAffordances(heights: number[], landingZones: LandingZone[]) {
  function nearLandingZone(x: number) {
    return landingZones.some(
      (zone) => x >= zone.x - 36 && x <= zone.x + zone.width + 36,
    );
  }

  for (let i = 0; i < heights.length; i++) {
    const x = i * TERRAIN_SEGMENT_SIZE;
    if (nearLandingZone(x)) continue;

    for (let center = 180; center < TERRAIN_TOTAL_WIDTH; center += 340) {
      const t = Math.abs((x - center) / 58);
      if (t < 1) {
        heights[i] += (1 - Math.cos(t * Math.PI * 2)) * 5;
      }
    }

    for (let center = 360; center < TERRAIN_TOTAL_WIDTH; center += 520) {
      const t = Math.abs((x - center) / 72);
      if (t < 1) {
        heights[i] += Math.cos(t * Math.PI) * 12 + 12;
      }

      const leftLip = Math.abs((x - (center - 72)) / 26);
      const rightLip = Math.abs((x - (center + 72)) / 26);
      if (leftLip < 1) heights[i] -= (1 - leftLip) * 16;
      if (rightLip < 1) heights[i] -= (1 - rightLip) * 16;
    }

    for (let center = 620; center < TERRAIN_TOTAL_WIDTH; center += 700) {
      const plateau = Math.abs(x - center);
      if (plateau < 56) {
        heights[i] -= 26;
      } else if (plateau < 106) {
        heights[i] -= (1 - (plateau - 56) / 50) * 26;
      }
    }
  }
}

export function generateForegroundHeightmap(
  totalWidth: number,
  roughness: number,
  landingZones: LandingZone[],
  seed = 0.31,
): number[] {
  const noise2D = createNoise2D(seededRandom(seed * 2147483647));
  const numPoints = Math.ceil(totalWidth / TERRAIN_SEGMENT_SIZE) + 1;
  const heights: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const x = i * TERRAIN_SEGMENT_SIZE;
    const nx = x / 520;
    let h =
      noise2D(nx * roughness, 0) * 30 +
      noise2D(nx * roughness * 2.4, 9) * 7 +
      noise2D(nx * roughness * 5, 4) * 2;

    const craterA = Math.sin(x / 47) * Math.sin(x / 89);
    if (craterA > 0.72) h += (craterA - 0.72) * 28;

    heights.push(TERRAIN_BASE_HEIGHT + h);
  }

  smoothHeights(heights, 3);
  addRoverAffordances(heights, landingZones);
  smoothHeights(heights, 1);
  flattenLandingZones(heights, landingZones);
  clampTerrainSlopes(heights);
  smoothHeights(heights, 1);
  flattenLandingZones(heights, landingZones);
  return heights;
}

export function generateJaggedHeightmap(
  totalWidth: number,
  landingZones: LandingZone[],
  foregroundHeights: number[],
  seed = 0.57,
): number[] {
  const random = seededRandom(seed * 2147483647);
  const numPoints = Math.ceil(totalWidth / TERRAIN_SEGMENT_SIZE) + 1;
  const controlStep = 28;
  const controls: number[] = [];
  const lowestLandingHeight = Math.max(
    ...landingZones.map((z) =>
      getTerrainHeightAt(foregroundHeights, z.x + z.width / 2),
    ),
  );

  let h = TERRAIN_BASE_HEIGHT + 55;
  for (let x = 0; x <= totalWidth + controlStep; x += controlStep) {
    h += (random() - 0.5) * 24;
    h = clamp(h, lowestLandingHeight + 14, TERRAIN_BASE_HEIGHT + 145);
    controls.push(h);
  }

  const heights: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = i * TERRAIN_SEGMENT_SIZE;
    const ci = Math.floor(x / controlStep);
    const t = (x - ci * controlStep) / controlStep;
    let y = (controls[ci] ?? h) * (1 - t) + (controls[ci + 1] ?? h) * t;

    y = Math.max(y, lowestLandingHeight + 14);
    heights.push(y);
  }

  for (const zone of landingZones) {
    const startIdx = Math.floor((zone.x - 12) / TERRAIN_SEGMENT_SIZE);
    const endIdx = Math.ceil((zone.x + zone.width + 12) / TERRAIN_SEGMENT_SIZE);
    const padY = getTerrainHeightAt(foregroundHeights, zone.x + zone.width / 2);
    for (let i = Math.max(0, startIdx); i <= endIdx && i < heights.length; i++) {
      heights[i] = Math.max(heights[i], padY + 18);
    }
  }

  clampTerrainSlopes(heights);
  smoothHeights(heights, 2);
  return heights;
}

export function generateVisualForegroundHeightmap(
  totalWidth: number,
  mainHeights: number[],
  jaggedness = 1,
  seed = 0.83,
): number[] {
  const random = seededRandom(seed * 2147483647);
  const numPoints = Math.ceil(totalWidth / TERRAIN_SEGMENT_SIZE) + 1;
  const amount = Math.max(0, jaggedness);
  const controlStep = Math.max(4, 26 - amount * 12);
  const controls: number[] = [];

  for (let x = 0; x <= totalWidth + controlStep; x += controlStep) {
    const mainY = getTerrainHeightAt(mainHeights, x);
    const rockyPeak = random() > Math.max(0.28, 0.88 - amount * 0.18);
    const low = 28 - amount * 8;
    const high = 40 + amount * 52;
    const offset = rockyPeak ? 12 + random() * 14 * amount : low + random() * high;
    controls.push(mainY + offset);
  }

  const heights: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = i * TERRAIN_SEGMENT_SIZE;
    const ci = Math.floor(x / controlStep);
    const t = (x - ci * controlStep) / controlStep;
    const eased = t < 0.5 ? t * 1.35 : 1 - (1 - t) * 0.7;
    const y0 = controls[ci] ?? TERRAIN_BASE_HEIGHT;
    const y1 = controls[ci + 1] ?? y0;
    const jagged =
      Math.sin(x * (0.45 + amount * 0.45)) * 3 * amount +
      Math.sin(x * (0.13 + amount * 0.14)) * 5 * amount;
    const mainY = getTerrainHeightAt(mainHeights, x);
    heights.push(Math.max(y0 * (1 - eased) + y1 * eased + jagged, mainY + 12));
  }

  return heights;
}

function combineSurfaceHeights(...heightmaps: number[][]): number[] {
  return heightmaps[0].map((_, i) =>
    Math.min(...heightmaps.map((heights) => heights[i] ?? TERRAIN_BASE_HEIGHT)),
  );
}

export function createTerrainGraphics(
  heights: number[],
  color: number,
  alpha: number,
  textured = false,
): Graphics {
  const g = new Graphics();
  const ppm = PIXELS_PER_METER;
  const wireframe = tuning.wireframe;

  function drawTerrainFill(fillColor: number, fillAlpha: number, drop = 1000) {
    g.moveTo(0, heights[0] * ppm);
    for (let i = 1; i < heights.length; i++) {
      g.lineTo(i * TERRAIN_SEGMENT_SIZE * ppm, heights[i] * ppm);
    }
    g.lineTo((heights.length - 1) * TERRAIN_SEGMENT_SIZE * ppm, drop * ppm);
    g.lineTo(0, drop * ppm);
    g.closePath();
    g.fill({ color: fillColor, alpha: fillAlpha });
  }

  if (wireframe) {
    g.moveTo(0, heights[0] * ppm);
    for (let i = 1; i < heights.length; i++) {
      g.lineTo(i * TERRAIN_SEGMENT_SIZE * ppm, heights[i] * ppm);
    }
    g.stroke({ color: WIREFRAME_COLOR, width: 2, alpha: 0.9 });
  } else {
    drawTerrainFill(color, alpha);
    if (textured) {
      drawTerrainFill(LUNAR_TOP, 0.38, TERRAIN_BASE_HEIGHT + 64);
      drawTerrainFill(LUNAR_MID, 0.2, TERRAIN_BASE_HEIGHT + 120);
      drawTerrainFill(LUNAR_SHADOW, 0.16);
      drawSurfaceHighlights(g, heights);
      drawProceduralRocks(g, heights);
    }
  }

  return g;
}

function terrainRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawSurfaceHighlights(g: Graphics, heights: number[]) {
  const ppm = PIXELS_PER_METER;
  g.moveTo(0, heights[0] * ppm);
  for (let i = 1; i < heights.length; i++) {
    g.lineTo(i * TERRAIN_SEGMENT_SIZE * ppm, heights[i] * ppm);
  }
  g.stroke({ color: 0xf2f3f5, width: 2, alpha: 0.22 });

  g.moveTo(0, (heights[0] + 7) * ppm);
  for (let i = 1; i < heights.length; i++) {
    g.lineTo(i * TERRAIN_SEGMENT_SIZE * ppm, (heights[i] + 7) * ppm);
  }
  g.stroke({ color: LUNAR_LOW, width: 4, alpha: 0.1 });
}

function drawProceduralRocks(g: Graphics, heights: number[]) {
  const ppm = PIXELS_PER_METER;
  const step = 42;

  for (let x = 24; x < TERRAIN_TOTAL_WIDTH - 24; x += step) {
    const r = terrainRandom(x * 0.173);
    if (r < 0.28) continue;

    const baseY = getTerrainHeightAt(heights, x);
    const width = (1.0 + terrainRandom(x * 0.41) * 2.6) * ppm;
    const height = (0.5 + terrainRandom(x * 0.67) * 1.6) * ppm;
    const px = x * ppm;
    const py = baseY * ppm;
    const lean = (terrainRandom(x * 0.91) - 0.5) * width * 0.45;

    g.moveTo(px - width * 0.55, py);
    g.lineTo(px + lean, py - height);
    g.lineTo(px, py);
    g.closePath();
    g.fill({ color: ROCK_LIGHT, alpha: 0.58 });

    g.moveTo(px, py);
    g.lineTo(px + lean, py - height);
    g.lineTo(px + width * 0.55, py);
    g.closePath();
    g.fill({ color: ROCK_DARK, alpha: 0.52 });

    g.moveTo(px - width * 0.55, py + 1);
    g.lineTo(px + width * 0.6, py + 1);
    g.stroke({ color: LUNAR_SHADOW, width: 1.5, alpha: 0.18 });
  }
}

export function createLandingZoneMarker(zone: LandingZone): Graphics {
  const g = new Graphics();
  const ppm = PIXELS_PER_METER;
  const x = zone.x * ppm;
  const w = zone.width * ppm;
  const color = tuning.wireframe ? WIREFRAME_COLOR : 0xffcc00;

  g.rect(x, -4, w, 4);
  if (tuning.wireframe) {
    g.stroke({ color, width: 2, alpha: 0.9 });
  } else {
    g.fill({ color, alpha: 0.8 });
  }

  g.rect(x, -4, 2, 8);
  if (tuning.wireframe) g.stroke({ color, width: 2 });
  else g.fill({ color });
  g.rect(x + w - 2, -4, 2, 8);
  if (tuning.wireframe) g.stroke({ color, width: 2 });
  else g.fill({ color });

  return g;
}

export interface TerrainSystem {
  foregroundHeights: number[];
  middleHeights: number[];
  visualForegroundHeights: number[];
  surfaceHeights: number[];
  landingZones: LandingZone[];
  layers: TerrainLayer[];
  landingZoneMarkers: Container;
}

export function redrawTerrainSystem(terrain: TerrainSystem) {
  const [bgLayer, midLayer, mainLayer, visualFgLayer] = terrain.layers;
  bgLayer.container.removeChildren();
  bgLayer.container.addChild(
    createTerrainGraphics(terrain.layers[0].heights, 0x1b2431, 0.62),
  );
  midLayer.container.removeChildren();
  midLayer.container.addChild(
    createTerrainGraphics(terrain.middleHeights, 0x515c6a, 0.88),
  );
  mainLayer.container.removeChildren();
  mainLayer.container.addChild(
    createTerrainGraphics(terrain.foregroundHeights, 0x9ba4b0, 1.0, true),
  );
  visualFgLayer.container.removeChildren();
  visualFgLayer.container.addChild(
    createTerrainGraphics(terrain.visualForegroundHeights, 0xbcc2ca, 1.0, true),
  );

  terrain.landingZoneMarkers.removeChildren();
  for (const zone of terrain.landingZones) {
    const marker = createLandingZoneMarker(zone);
    const heightIdx = Math.floor(zone.x / TERRAIN_SEGMENT_SIZE);
    const zoneY =
      (terrain.foregroundHeights[heightIdx] ?? TERRAIN_BASE_HEIGHT) *
      PIXELS_PER_METER;
    marker.y = zoneY;
    terrain.landingZoneMarkers.addChild(marker);
  }
}

export function createTerrainSystem(): TerrainSystem {
  const landingZones: LandingZone[] = missions.map((m, i) => ({
    x: m.terrain.landingZoneX,
    width: m.terrain.landingZoneWidth,
    missionIndex: i,
  }));

  const avgRoughness =
    missions.reduce((s, m) => s + m.terrain.roughness, 0) / missions.length;

  const foregroundHeights = generateForegroundHeightmap(
    TERRAIN_TOTAL_WIDTH,
    avgRoughness,
    landingZones,
  );

  const middleHeights = generateJaggedHeightmap(
    TERRAIN_TOTAL_WIDTH,
    landingZones,
    foregroundHeights,
  );
  const surfaceHeights = combineSurfaceHeights(foregroundHeights, middleHeights);
  const bgHeights = generateHeightmap(TERRAIN_TOTAL_WIDTH, 0.25, [], 0.73);
  const visualForegroundHeights = generateVisualForegroundHeightmap(
    TERRAIN_TOTAL_WIDTH,
    surfaceHeights,
    tuning.foregroundJaggedness,
  );

  const bgLayer: TerrainLayer = {
    container: new Container(),
    heights: bgHeights,
    parallaxFactor: 0.2,
  };
  bgLayer.container.addChild(
    createTerrainGraphics(bgHeights, 0x1b2431, 0.62),
  );

  const midLayer: TerrainLayer = {
    container: new Container(),
    heights: middleHeights,
    parallaxFactor: 1,
  };
  midLayer.container.addChild(
    createTerrainGraphics(middleHeights, 0x515c6a, 0.88),
  );

  const fgLayer: TerrainLayer = {
    container: new Container(),
    heights: foregroundHeights,
    parallaxFactor: 1.0,
  };
  fgLayer.container.addChild(
    createTerrainGraphics(foregroundHeights, 0x9ba4b0, 1.0, true),
  );

  const visualFgLayer: TerrainLayer = {
    container: new Container(),
    heights: visualForegroundHeights,
    parallaxFactor: 1.28,
  };
  visualFgLayer.container.addChild(
    createTerrainGraphics(visualForegroundHeights, 0xbcc2ca, 1.0, true),
  );

  const landingZoneMarkers = new Container();
  for (const zone of landingZones) {
    const marker = createLandingZoneMarker(zone);
    const heightIdx = Math.floor(zone.x / TERRAIN_SEGMENT_SIZE);
    const zoneY = (foregroundHeights[heightIdx] ?? TERRAIN_BASE_HEIGHT) * PIXELS_PER_METER;
    marker.y = zoneY;
    landingZoneMarkers.addChild(marker);
  }

  return {
    foregroundHeights,
    middleHeights,
    visualForegroundHeights,
    surfaceHeights,
    landingZones,
    layers: [bgLayer, midLayer, fgLayer, visualFgLayer],
    landingZoneMarkers,
  };
}

export function getTerrainHeightAt(heights: number[], worldX: number): number {
  const idx = worldX / TERRAIN_SEGMENT_SIZE;
  const i = Math.floor(idx);
  const t = idx - i;
  const h0 = heights[Math.max(0, Math.min(i, heights.length - 1))];
  const h1 = heights[Math.max(0, Math.min(i + 1, heights.length - 1))];
  return h0 + (h1 - h0) * t;
}
