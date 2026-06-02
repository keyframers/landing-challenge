import {
  Graphics,
  Container,
  Mesh,
  MeshGeometry,
  Text,
  Texture,
} from 'pixi.js';
import gsap from 'gsap';
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
const FOREGROUND_TOP = 0xcdcdd2;
const FOREGROUND_BOTTOM = 0x343946;
const VISUAL_FOREGROUND_FILL = 0x4c5260;
let foregroundGradientTexture: Texture | null = null;

type TerrainRenderMode = 'flat' | 'mainGradient' | 'foregroundDark';

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
  const noise2D = createNoise2D(
    seed != null ? seededRandom(seed * 2147483647) : undefined,
  );
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
      next[i] =
        heights[i - 1] * 0.25 + heights[i] * 0.5 + heights[i + 1] * 0.25;
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
    for (
      let i = Math.max(0, startIdx);
      i <= endIdx && i < heights.length;
      i++
    ) {
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
  const amount = Math.max(0, jaggedness) * 0.35;
  const controlStep = 58;
  const controls: number[] = [];

  for (let x = 0; x <= totalWidth + controlStep; x += controlStep) {
    const mainY = getTerrainHeightAt(mainHeights, x);
    const offset = 34 + random() * (28 + amount * 18);
    controls.push(mainY + offset);
  }

  const heights: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = i * TERRAIN_SEGMENT_SIZE;
    const ci = Math.floor(x / controlStep);
    const t = (x - ci * controlStep) / controlStep;
    const eased = t * t * (3 - 2 * t);
    const y0 = controls[ci] ?? TERRAIN_BASE_HEIGHT;
    const y1 = controls[ci + 1] ?? y0;
    const jagged =
      Math.sin(x * 0.08) * 1.5 * amount + Math.sin(x * 0.025) * 3 * amount;
    const mainY = getTerrainHeightAt(mainHeights, x);
    heights.push(Math.max(y0 * (1 - eased) + y1 * eased + jagged, mainY + 22));
  }

  smoothHeights(heights, 2);
  for (let i = 0; i < heights.length; i++) {
    const x = i * TERRAIN_SEGMENT_SIZE;
    heights[i] = Math.max(heights[i], getTerrainHeightAt(mainHeights, x) + 22);
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
  mode: TerrainRenderMode = 'flat',
): Container {
  const container = new Container();
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
    container.addChild(g);
  } else {
    if (mode === 'mainGradient') {
      const mesh = createTerrainGradientMesh(heights, alpha);
      container.addChild(mesh);
      drawSurfaceHighlights(g, heights);
      container.addChild(g);
    } else if (mode === 'foregroundDark') {
      drawTerrainFill(VISUAL_FOREGROUND_FILL, alpha);
      container.addChild(g);
    } else {
      drawTerrainFill(color, alpha);
      container.addChild(g);
    }
  }

  return container;
}

function createForegroundGradientTexture() {
  if (foregroundGradientTexture) return foregroundGradientTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    foregroundGradientTexture = Texture.WHITE;
    return foregroundGradientTexture;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#CDCDD2');
  gradient.addColorStop(1, '#343946');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  foregroundGradientTexture = Texture.from(canvas);
  return foregroundGradientTexture;
}

function createTerrainGradientMesh(heights: number[], alpha: number) {
  const ppm = PIXELS_PER_METER;
  const dropY = 1000 * ppm;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < heights.length; i++) {
    const x = i * TERRAIN_SEGMENT_SIZE * ppm;
    const topY = heights[i] * ppm;
    positions.push(x, topY, x, dropY);
    uvs.push(0, 0, 0, 1);
  }

  for (let i = 0; i < heights.length - 1; i++) {
    const topLeft = i * 2;
    const bottomLeft = topLeft + 1;
    const topRight = topLeft + 2;
    const bottomRight = topLeft + 3;
    indices.push(
      topLeft,
      bottomLeft,
      topRight,
      topRight,
      bottomLeft,
      bottomRight,
    );
  }

  const mesh = new Mesh({
    geometry: new MeshGeometry({
      positions: new Float32Array(positions),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
    }),
    texture: createForegroundGradientTexture(),
  });
  mesh.alpha = alpha;
  return mesh;
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
  g.stroke({ color: FOREGROUND_BOTTOM, width: 4, alpha: 0.1 });
}

export function createLandingZoneMarker(zone: LandingZone): Container {
  const marker = new Container();
  const ppm = PIXELS_PER_METER;
  const w = zone.width * ppm;
  const color = tuning.wireframe ? WIREFRAME_COLOR : 0xf4c56f;

  marker.x = zone.x * ppm;

  const glow = new Graphics();
  glow.roundRect(-w * 0.04, -5, w * 1.08, 10, 5);
  glow.fill({ color, alpha: tuning.wireframe ? 0 : 0.42 });
  glow.label = 'landingZoneGlow';
  marker.addChild(glow);

  if (!tuning.wireframe) {
    gsap.to(glow, {
      alpha: 0.78,
      duration: 1.25,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    });
  }

  const pad = new Graphics();
  pad.moveTo(0, 0).lineTo(w, 0);
  pad.stroke({ color, width: tuning.wireframe ? 2 : 2.5, alpha: 0.95 });
  marker.addChild(pad);

  const posts = new Graphics();
  posts.moveTo(0, -2).lineTo(0, -28);
  posts.moveTo(w, -2).lineTo(w, -28);
  posts.stroke({
    color: tuning.wireframe ? color : 0xdfe4ec,
    width: 1.5,
    alpha: 0.85,
  });
  posts.circle(0, -30, 2.6).fill({ color, alpha: 0.95 });
  posts.circle(w, -30, 2.6).fill({ color, alpha: 0.95 });
  posts.label = 'landingZonePosts';
  marker.addChild(posts);

  // Text + arrow live in a single indicator group. The per-element GSAP tweens
  // below animate each child's own alpha; the group's alpha is driven by lander
  // proximity (see updateLandingZoneProximity) so multiplying down the tree
  // fades the whole indicator out as the lander approaches.
  const indicator = new Container();
  indicator.label = 'lzIndicator';
  marker.addChild(indicator);

  const label = new Text({
    text: 'LANDING ZONE',
    style: {
      fill: color,
      fontFamily: 'monospace',
      fontSize: 20,
      letterSpacing: 2,
    },
  });
  label.anchor.set(0.5);
  label.x = w / 2;
  label.y = -56;
  indicator.addChild(label);

  const chevron = new Graphics();
  chevron.moveTo(w / 2 - 5, -42);
  chevron.lineTo(w / 2, -34);
  chevron.lineTo(w / 2 + 5, -42);
  chevron.stroke({ color, width: 1.5, alpha: 0.95 });
  indicator.addChild(chevron);

  // Smooth text pulse between full and half opacity.
  gsap.to(label, {
    alpha: 0.5,
    duration: 1.1,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
  });

  // Arrow drops down, fades out, then snaps back and repeats.
  const arrow = gsap.timeline({ repeat: -1, repeatDelay: 0.25 });
  arrow
    .set(chevron, { y: 0, alpha: 0.95 })
    .to(chevron, { y: 9, duration: 0.85, ease: 'sine.in' }, 0)
    .to(chevron, { alpha: 0, duration: 0.4, ease: 'power2.in' }, 0.5);

  return marker;
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
    createTerrainGraphics(terrain.foregroundHeights, 0x9ba4b0, 1.0, 'mainGradient'),
  );
  visualFgLayer.container.removeChildren();
  visualFgLayer.container.addChild(
    createTerrainGraphics(
      terrain.visualForegroundHeights,
      VISUAL_FOREGROUND_FILL,
      1.0,
      'foregroundDark',
    ),
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

// Distance (in meters) over which the indicator fades: fully visible at/beyond
// FAR, nearly invisible at/within NEAR.
const LZ_FADE_NEAR = 7;
const LZ_FADE_FAR = 26;

/**
 * Fade each landing-zone indicator (text + arrow) toward ~0 as the lander
 * approaches. Pass the lander position in meters, or null to restore full
 * visibility (e.g. no active vehicle).
 */
export function updateLandingZoneProximity(
  terrain: TerrainSystem,
  currentMission: number,
  landerX: number | null,
  landerY: number | null,
) {
  const markers = terrain.landingZoneMarkers.children;
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i] as Container;
    const zone = terrain.landingZones[i];
    const active = zone.missionIndex === currentMission;
    const glow = marker.getChildByLabel('landingZoneGlow');
    const posts = marker.getChildByLabel('landingZonePosts');
    const indicator = marker.getChildByLabel('lzIndicator');

    if (glow) glow.visible = active;
    if (posts) posts.visible = active;
    if (indicator) indicator.visible = active;
    if (!active) continue;
    if (!indicator) continue;

    if (landerX == null || landerY == null) {
      indicator.alpha = 1;
      continue;
    }

    const centerX = zone.x + zone.width / 2;
    const zoneY = marker.y / PIXELS_PER_METER;
    const dist = Math.hypot(landerX - centerX, landerY - zoneY);
    const t = (dist - LZ_FADE_NEAR) / (LZ_FADE_FAR - LZ_FADE_NEAR);
    indicator.alpha = Math.max(0, Math.min(1, t));
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
  const surfaceHeights = combineSurfaceHeights(
    foregroundHeights,
    middleHeights,
  );
  const bgHeights = generateHeightmap(TERRAIN_TOTAL_WIDTH, 0.25, [], 0.73);
  const visualForegroundHeights = generateVisualForegroundHeightmap(
    TERRAIN_TOTAL_WIDTH,
    foregroundHeights,
    tuning.foregroundJaggedness,
  );

  const bgLayer: TerrainLayer = {
    container: new Container(),
    heights: bgHeights,
    parallaxFactor: 0.2,
  };
  bgLayer.container.addChild(createTerrainGraphics(bgHeights, 0x1b2431, 0.62));

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
    createTerrainGraphics(foregroundHeights, 0x9ba4b0, 1.0, 'mainGradient'),
  );

  const visualFgLayer: TerrainLayer = {
    container: new Container(),
    heights: visualForegroundHeights,
    parallaxFactor: 1.28,
  };
  visualFgLayer.container.addChild(
    createTerrainGraphics(
      visualForegroundHeights,
      VISUAL_FOREGROUND_FILL,
      1.0,
      'foregroundDark',
    ),
  );

  const landingZoneMarkers = new Container();
  for (const zone of landingZones) {
    const marker = createLandingZoneMarker(zone);
    const heightIdx = Math.floor(zone.x / TERRAIN_SEGMENT_SIZE);
    const zoneY =
      (foregroundHeights[heightIdx] ?? TERRAIN_BASE_HEIGHT) * PIXELS_PER_METER;
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
