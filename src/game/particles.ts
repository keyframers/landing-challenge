import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { PIXELS_PER_METER } from './constants';
import { tuning } from './tuning';

const WIREFRAME_COLOR = 0xffffff;

interface Particle {
  graphic: Graphics;
  tween: gsap.core.Tween;
}

export class ParticleSystem {
  container: Container;
  private particles: Particle[] = [];

  constructor() {
    this.container = new Container();
  }

  emitThrust(
    worldX: number,
    worldY: number,
    angle: number,
    intensity: number,
  ) {
    const count = Math.floor(intensity * 3) + 1;
    const ppm = PIXELS_PER_METER;

    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const size = 2 + Math.random() * 4;
      g.circle(0, 0, size);
      if (tuning.wireframe) {
        g.stroke({ color: WIREFRAME_COLOR, width: 1, alpha: 0.9 });
      } else {
        g.fill({ color: this.thrustColor(), alpha: 0.9 });
      }

      g.x = worldX * ppm;
      g.y = worldY * ppm;

      this.container.addChild(g);

      const spread = (Math.random() - 0.5) * 0.8;
      const thrustAngle = angle + Math.PI / 2 + spread;
      const speed = (80 + Math.random() * 120) * intensity;
      const vx = Math.cos(thrustAngle) * speed;
      const vy = Math.sin(thrustAngle) * speed;

      const tween = gsap.to(g, {
        x: g.x + vx,
        y: g.y + vy,
        alpha: 0,
        duration: 0.3 + Math.random() * 0.4,
        ease: 'power2.out',
        onComplete: () => {
          this.container.removeChild(g);
          g.destroy();
          this.particles = this.particles.filter((p) => p.graphic !== g);
        },
      });

      this.particles.push({ graphic: g, tween });
    }
  }

  emitExplosion(worldX: number, worldY: number) {
    const ppm = PIXELS_PER_METER;
    const count = 30;

    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const size = 3 + Math.random() * 6;
      const color = Math.random() > 0.5 ? 0xff6600 : 0xffaa00;
      g.circle(0, 0, size);
      if (tuning.wireframe) {
        g.stroke({ color: WIREFRAME_COLOR, width: 1, alpha: 1 });
      } else {
        g.fill({ color, alpha: 1 });
      }

      g.x = worldX * ppm;
      g.y = worldY * ppm;

      this.container.addChild(g);

      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 80;

      const tween = gsap.to(g, {
        x: g.x + vx,
        y: g.y + vy + 150,
        alpha: 0,
        duration: 0.6 + Math.random() * 0.8,
        ease: 'power2.out',
        onComplete: () => {
          this.container.removeChild(g);
          g.destroy();
          this.particles = this.particles.filter((p) => p.graphic !== g);
        },
      });

      this.particles.push({ graphic: g, tween });
    }
  }

  emitDust(worldX: number, worldY: number) {
    const ppm = PIXELS_PER_METER;
    const count = 15;

    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const size = 4 + Math.random() * 8;
      g.circle(0, 0, size);
      if (tuning.wireframe) {
        g.stroke({ color: WIREFRAME_COLOR, width: 1, alpha: 0.6 });
      } else {
        g.fill({ color: 0x888888, alpha: 0.5 });
      }

      g.x = worldX * ppm;
      g.y = worldY * ppm;

      this.container.addChild(g);

      const angle = -Math.PI + Math.random() * Math.PI;
      const speed = 40 + Math.random() * 80;

      const tween = gsap.to(g, {
        x: g.x + Math.cos(angle) * speed,
        y: g.y + Math.sin(angle) * speed - 30,
        alpha: 0,
        duration: 0.8 + Math.random() * 0.6,
        ease: 'power1.out',
        onComplete: () => {
          this.container.removeChild(g);
          g.destroy();
          this.particles = this.particles.filter((p) => p.graphic !== g);
        },
      });

      this.particles.push({ graphic: g, tween });
    }
  }

  private thrustColor(): number {
    const colors = [0xffcc00, 0xff8800, 0xffffff, 0xffee66];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  destroy() {
    for (const p of this.particles) {
      p.tween.kill();
      p.graphic.destroy();
    }
    this.particles = [];
    this.container.parent?.removeChild(this.container);
    this.container.destroy();
  }
}
