import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import gsap from 'gsap';
import earthSvgUrl from '../data/Earth.svg?url';
import { STARFIELD_COUNT } from './constants';

let earthTexture: Texture | null = null;

export async function loadEarthGraphics() {
  earthTexture = await Assets.load<Texture>(earthSvgUrl);
}

export function createStarfield(width: number, height: number): Container {
  const container = new Container();

  for (let i = 0; i < STARFIELD_COUNT; i++) {
    const star = new Graphics();
    const size = 0.5 + Math.random() * 1.5;
    const brightness = 0.3 + Math.random() * 0.7;

    star.circle(0, 0, size);
    star.fill({ color: 0xffffff, alpha: brightness });

    star.x = Math.random() * width * 3;
    star.y = Math.random() * height;

    if (Math.random() < 0.1) {
      gsap.to(star, {
        alpha: brightness * 0.3,
        duration: 1 + Math.random() * 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: Math.random() * 3,
      });
    }

    container.addChild(star);
  }

  return container;
}

export function createEarth(): Container {
  const container = new Container();

  const earth = new Sprite(earthTexture ?? Texture.WHITE);
  earth.anchor.set(0.5);
  earth.width = 46;
  earth.height = 46;
  container.addChild(earth);

  return container;
}
