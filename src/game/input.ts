import { KONAMI_CODE } from './constants';

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
}

export class InputManager {
  state: InputState = { left: false, right: false, up: false };
  private konamiBuffer: string[] = [];
  private onKonami: (() => void) | null = null;
  private onAnyControl: (() => void) | null = null;
  private onEscape: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  setKonamiCallback(cb: () => void) {
    this.onKonami = cb;
  }

  setAnyControlCallback(cb: () => void) {
    this.onAnyControl = cb;
  }

  setEscapeCallback(cb: () => void) {
    this.onEscape = cb;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      this.onEscape?.();
      return;
    }
    this.mapKey(e.code, true);
    this.checkKonami(e.code);
    if (this.state.left || this.state.right || this.state.up) {
      this.onAnyControl?.();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.mapKey(e.code, false);
  };

  private mapKey(code: string, pressed: boolean) {
    switch (code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.state.left = pressed;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.state.right = pressed;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.state.up = pressed;
        break;
    }
  }

  private checkKonami(code: string) {
    this.konamiBuffer.push(code);
    if (this.konamiBuffer.length > KONAMI_CODE.length) {
      this.konamiBuffer.shift();
    }
    if (
      this.konamiBuffer.length === KONAMI_CODE.length &&
      this.konamiBuffer.every((k, i) => k === KONAMI_CODE[i])
    ) {
      this.konamiBuffer = [];
      this.onKonami?.();
    }
  }

  setTouch(direction: 'left' | 'right' | 'up', pressed: boolean) {
    this.state[direction] = pressed;
    if (pressed) this.onAnyControl?.();
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
