// Input.ts — keyboard and mouse state. Lightweight, no dependencies.
//
// Tracks key down/up, mouse movement, mouse buttons. Pointer lock for
// first-person camera. Exposes a `consumePressed` helper for one-shot
// keys like E (interact) and T (toggle weapon) so they don't repeat.

export type Key =
  | "w" | "a" | "s" | "d"
  | "shift" | "space" | "ctrl"
  | "e" | "t" | "q" | "r" | "f" | "x"
  | "tab" | "escape"
  | "1" | "2" | "3";

export class Input {
  private keysDown = new Set<Key>();
  private keysPressed = new Set<Key>();
  private mouseDX = 0;
  private mouseDY = 0;
  private mouseDown = new Set<number>();
  private mousePressed = new Set<number>();
  private wheelDelta = 0;
  private pointerLocked = false;
  private listeners: Array<() => void> = [];

  constructor(private canvas: HTMLElement) {
    this.attach();
  }

  isDown(k: Key): boolean {
    return this.keysDown.has(k);
  }

  release(k: Key): void {
    this.keysDown.delete(k);
  }

  consumePressed(k: Key): boolean {
    if (this.keysPressed.has(k)) {
      this.keysPressed.delete(k);
      return true;
    }
    return false;
  }

  mouseDeltaX(): number { return this.mouseDX; }
  mouseDeltaY(): number { return this.mouseDY; }
  isMouseDown(button: number): boolean { return this.mouseDown.has(button); }
  consumeMousePressed(button: number): boolean {
    if (this.mousePressed.has(button)) {
      this.mousePressed.delete(button);
      return true;
    }
    return false;
  }
  getWheelDelta(): number { return this.wheelDelta; }

  isPointerLocked(): boolean { return this.pointerLocked; }

  requestPointerLock(): void {
    if (!this.pointerLocked) {
      this.canvas.requestPointerLock();
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) {
      document.exitPointerLock();
    }
  }

  endFrame(): void {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.keysPressed.clear();
    this.mousePressed.clear();
  }

  private attach(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = this.mapKey(e);
      if (!k) return;
      if (!this.keysDown.has(k)) this.keysPressed.add(k);
      this.keysDown.add(k);
      if (k === "tab" || k === "space") e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = this.mapKey(e);
      if (k) this.keysDown.delete(k);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!this.mouseDown.has(e.button)) this.mousePressed.add(e.button);
      this.mouseDown.add(e.button);
      if (!this.pointerLocked) this.canvas.requestPointerLock();
    };
    const onMouseUp = (e: MouseEvent) => {
      this.mouseDown.delete(e.button);
    };
    const onWheel = (e: WheelEvent) => {
      this.wheelDelta += e.deltaY;
    };
    const onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    this.canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    this.canvas.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("pointerlockchange", onPointerLockChange);
    this.canvas.addEventListener("contextmenu", onContextMenu);

    this.listeners.push(
      () => window.removeEventListener("keydown", onKeyDown),
      () => window.removeEventListener("keyup", onKeyUp),
      () => window.removeEventListener("mousemove", onMouseMove),
      () => this.canvas.removeEventListener("mousedown", onMouseDown),
      () => window.removeEventListener("mouseup", onMouseUp),
      () => this.canvas.removeEventListener("wheel", onWheel),
      () => document.removeEventListener("pointerlockchange", onPointerLockChange),
      () => this.canvas.removeEventListener("contextmenu", onContextMenu),
    );
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
  }

  private mapKey(e: KeyboardEvent): Key | null {
    const k = e.key.toLowerCase();
    if (k === " ") return "space";
    if (k === "escape") return "escape";
    if (k === "tab") return "tab";
    if (k === "shift") return "shift";
    if (k === "control") return "ctrl";
    if (/^[wasdqerfxt]$/.test(k)) return k as Key;
    if (k === "1" || k === "2" || k === "3") return k as Key;
    return null;
  }
}
