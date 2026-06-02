import { KONAMI_CODE } from "./constants";

export interface InputState {
  left: number;
  right: number;
  up: number;
}

export class InputManager {
  state: InputState = { left: 0, right: 0, up: 0 };
  private konamiBuffer: string[] = [];
  private onKonami: (() => void) | null = null;
  private onAnyControl: (() => void) | null = null;
  private onEscape: (() => void) | null = null;

  constructor() {
    window.addEventListener("keydown", this.handleKeyDown, { capture: true });
    window.addEventListener("keyup", this.handleKeyUp, { capture: true });
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
    if (e.code === "Escape") {
      this.onEscape?.();
      return;
    }
    this.mapKey(e.code, true);
    if (this.state.left || this.state.right || this.state.up) {
      e.preventDefault();
    }
    this.checkKonami(e.code);
    if (this.state.left || this.state.right || this.state.up) {
      this.onAnyControl?.();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.mapKey(e.code, false);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "KeyW", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  };

  private mapKey(code: string, pressed: boolean) {
    const value = pressed ? 1 : 0;
    switch (code) {
      case "ArrowLeft":
        this.state.left = value;
        break;
      case "ArrowRight":
        this.state.right = value;
        break;
      case "ArrowUp":
      case "KeyA":
      case "Space":
        this.state.up = value;
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

  setTouch(direction: "left" | "right" | "up", pressed: boolean) {
    this.state[direction] = pressed ? 1 : 0;
    if (pressed) this.onAnyControl?.();
  }

  setAnalog(input: InputState) {
    this.state.left = input.left;
    this.state.right = input.right;
    this.state.up = input.up;
    if (input.left > 0 || input.right > 0 || input.up > 0) {
      this.onAnyControl?.();
    }
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown, { capture: true });
    window.removeEventListener("keyup", this.handleKeyUp, { capture: true });
  }
}
