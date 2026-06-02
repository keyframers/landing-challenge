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

function combineSurfaceHeights(...heightmaps: number[][]): number[] {
  return heightmaps[0].map((_, i) =>
    Math.min(...heightmaps.map((heights) => heights[i] ?? TERRAIN_BASE_HEIGHT)),
  );
}

export function createTerrainGraphics(
  heights: number[],
  color: number,
  alpha: number,
): Graphics {
  const g = new Graphics();
  const ppm = PIXELS_PER_METER;
  const wireframe = tuning.wireframe;

  g.moveTo(0, heights[0] * ppm);
  for (let i = 1; i < heights.length; i++) {
    g.lineTo(i * TERRAIN_SEGMENT_SIZE * ppm, heights[i] * ppm);
  }
  if (wireframe) {
    g.stroke({ color: WIREFRAME_COLOR, width: 2, alpha: 0.9 });
  } else {
    g.lineTo((heights.length - 1) * TERRAIN_SEGMENT_SIZE * ppm, 1000 * ppm);
    g.lineTo(0, 1000 * ppm);
    g.closePath();
    g.fill({ color, alpha });
  }

  return g;
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
  surfaceHeights: number[];
  landingZones: LandingZone[];
  layers: TerrainLayer[];
  landingZoneMarkers: Container;
}

export function redrawTerrainSystem(terrain: TerrainSystem) {
  const [bgLayer, midLayer, fgLayer] = terrain.layers;
  bgLayer.container.removeChildren();
  bgLayer.container.addChild(
    createTerrainGraphics(terrain.layers[0].heights, 0x171726, 0.55),
  );
  midLayer.container.removeChildren();
  midLayer.container.addChild(
    createTerrainGraphics(terrain.middleHeights, 0x252536, 0.85),
  );
  fgLayer.container.removeChildren();
  fgLayer.container.addChild(
    createTerrainGraphics(terrain.foregroundHeights, 0x3a3a4a, 1.0),
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

  const bgLayer: TerrainLayer = {
    container: new Container(),
    heights: bgHeights,
    parallaxFactor: 0.2,
  };
  bgLayer.container.addChild(
    createTerrainGraphics(bgHeights, 0x171726, 0.55),
  );

  const midLayer: TerrainLayer = {
    container: new Container(),
    heights: middleHeights,
    parallaxFactor: 1,
  };
  midLayer.container.addChild(
    createTerrainGraphics(middleHeights, 0x252536, 0.85),
  );

  const fgLayer: TerrainLayer = {
    container: new Container(),
    heights: foregroundHeights,
    parallaxFactor: 1.0,
  };
  fgLayer.container.addChild(
    createTerrainGraphics(foregroundHeights, 0x3a3a4a, 1.0),
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
    surfaceHeights,
    landingZones,
    layers: [bgLayer, midLayer, fgLayer],
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
