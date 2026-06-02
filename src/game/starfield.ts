import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import earthSvgUrl from '../data/Earth.svg?url';
import { STARFIELD_COUNT } from './constants';

let earthTexture: Texture | null = null;
const COMET_COLORS = [0xffffff, 0xbfd7ff, 0xffe0a8];
const COMET_GRAVITY = 70;
const COMET_TRAIL_LENGTH = 22;

export async function loadEarthGraphics() {
  earthTexture = await Assets.load<Texture>(earthSvgUrl);
}

export function createStarfield(width: number, height: number): Container {
  const container = new Container();
  const stars: Array<{
    graphic: Graphics;
    baseAlpha: number;
    twinkle: { value: number };
  }> = [];
  const comets: Array<{
    container: Container;
    head: Graphics;
    trail: Graphics;
    color: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
    lifetime: number;
    points: Array<{ x: number; y: number }>;
  }> = [];
  let destroyed = false;
  let cometCall: gsap.core.Tween | null = null;

  for (let i = 0; i < STARFIELD_COUNT; i++) {
    const star = new Graphics();
    const size = 0.5 + Math.random() * 1.5;
    const brightness = 0.3 + Math.random() * 0.7;
    const twinkle = { value: 0 };

    star.circle(0, 0, size);
    star.fill({ color: 0xffffff, alpha: 1 });
    star.alpha = brightness;

    star.x = Math.random() * width;
    star.y = Math.random() * height;

    gsap.to(twinkle, {
      value: Math.random() * 0.55,
      duration: 0.7 + Math.random() * 2.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: Math.random() * 3,
    });

    stars.push({ graphic: star, baseAlpha: brightness, twinkle });
    container.addChild(star);
  }

  function updateTwinkles() {
    for (const star of stars) {
      star.graphic.alpha = Math.min(1, star.baseAlpha + star.twinkle.value);
    }
  }

  function cometAlpha(age: number, lifetime: number) {
    return Math.max(0, Math.min(1, age / 0.22, (lifetime - age) / 0.55));
  }

  function drawCometTrail(
    trail: Graphics,
    points: Array<{ x: number; y: number }>,
    color: number,
    alpha: number,
  ) {
    trail.clear();
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const t = 1 - i / points.length;
      trail.moveTo(a.x, a.y);
      trail.lineTo(b.x, b.y);
      trail.stroke({
        color,
        width: 1 + t * 3.4,
        alpha: alpha * t * 0.72,
      });
    }
  }

  function updateComets(_time: number, deltaTime: number) {
    const dt = Math.min(deltaTime / 1000, 0.04);

    for (let i = comets.length - 1; i >= 0; i--) {
      const comet = comets[i];
      comet.age += dt;
      comet.vy += COMET_GRAVITY * dt;
      comet.x += comet.vx * dt;
      comet.y += comet.vy * dt;
      comet.points.unshift({ x: comet.x, y: comet.y });
      comet.points.length = Math.min(comet.points.length, COMET_TRAIL_LENGTH);

      const alpha = cometAlpha(comet.age, comet.lifetime);
      comet.container.alpha = alpha;
      comet.head.x = comet.x;
      comet.head.y = comet.y;
      drawCometTrail(comet.trail, comet.points, comet.color, alpha);

      if (
        comet.age > comet.lifetime ||
        comet.x > width + 120 ||
        comet.y > height + 120
      ) {
        comet.container.destroy();
        comets.splice(i, 1);
      }
    }
  }

  function createComet() {
    if (destroyed) return;

    const comet = new Container();
    const color = COMET_COLORS[Math.floor(Math.random() * COMET_COLORS.length)];
    const startX = Math.random() * width * 0.55 - width * 0.22;
    const startY = Math.random() * height * 0.42 + height * 0.02;
    const vx = 440 + Math.random() * 260;
    const vy = 95 + Math.random() * 135;
    const lifetime = 1.7 + Math.random() * 0.9;
    comet.alpha = 0;

    const trail = new Graphics();
    comet.addChild(trail);

    const head = new Graphics();
    head.circle(0, 0, 3.6 + Math.random() * 1.2);
    head.fill({ color, alpha: 0.95 });
    comet.addChild(head);

    container.addChild(comet);
    comets.push({
      container: comet,
      head,
      trail,
      color,
      x: startX,
      y: startY,
      vx,
      vy,
      age: 0,
      lifetime,
      points: [{ x: startX, y: startY }],
    });
  }

  function scheduleComet() {
    if (destroyed) return;
    cometCall = gsap.delayedCall(4 + Math.random() * 5, () => {
      createComet();
      scheduleComet();
    });
  }

  gsap.ticker.add(updateTwinkles);
  gsap.ticker.add(updateComets);
  gsap.delayedCall(2 + Math.random() * 3, createComet);
  scheduleComet();

  const destroy = container.destroy.bind(container);
  container.destroy = ((options?: Parameters<Container['destroy']>[0]) => {
    destroyed = true;
    cometCall?.kill();
    gsap.ticker.remove(updateTwinkles);
    gsap.ticker.remove(updateComets);
    for (const star of stars) gsap.killTweensOf(star.twinkle);
    destroy(options);
  }) as Container['destroy'];

  return container;
}

export function createEarth(): Container {
  const container = new Container();

  const earth = new Sprite(earthTexture ?? Texture.WHITE);
  earth.anchor.set(0.5);
  earth.width = 58;
  earth.height = 58;
  container.addChild(earth);

  return container;
}
