import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { STARFIELD_COUNT } from './constants';

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

  const glow = new Graphics();
  glow.circle(0, 0, 30);
  glow.fill({ color: 0x4488cc, alpha: 0.15 });
  container.addChild(glow);

  const earth = new Graphics();
  earth.circle(0, 0, 15);
  earth.fill({ color: 0x4477aa });

  const land = new Graphics();
  land.circle(-3, -2, 6);
  land.fill({ color: 0x55aa55, alpha: 0.6 });
  land.circle(4, 4, 4);
  land.fill({ color: 0x55aa55, alpha: 0.5 });

  container.addChild(earth);
  container.addChild(land);

  return container;
}
