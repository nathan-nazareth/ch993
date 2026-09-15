// MovementSystem.ts — applies WASD movement to the player, taking
// mount state into account. When mounted on a horse, the player moves
// like a passenger (the horse follows). When mounted on the eagle, the
// mount system handles flight directly.

import * as THREE from "three";
import { Input } from "../core/Input";
import { Player } from "../entities/Player";
import { MountSystem } from "./MountSystem";

const RUN_STAMINA_THRESHOLD = 25;
const RUN_STAMINA_COST = 18;

export class MovementSystem {
  constructor(
    private player: Player,
    private input: Input,
    private mount: MountSystem,
  ) {}

  fixedUpdate(dt: number, state: { stamina: number; setStamina: (n: number) => void }): void {
    if (this.mount.isRiding && this.mount.currentMount === "eagle") {
      this.player.velocity.set(0, 0, 0);
      return;
    }
    if (state.stamina < RUN_STAMINA_THRESHOLD) {
      this.input.release("shift");
    }
    const isRunning = this.input.isDown("shift");
    const mounted = this.mount.isRiding && this.mount.currentMount === "horse";
    const { dir, speed } = this.player.getMoveDir(this.player.yaw, mounted);
    const effectiveSpeed = isRunning ? speed * 1.6 : speed;
    this.player.applyMovement(dir, effectiveSpeed, dt, isRunning);

    this.player.velocity.copy(dir).multiplyScalar(effectiveSpeed);

    if (isRunning && (this.input.isDown("w") || this.input.isDown("a") || this.input.isDown("s") || this.input.isDown("d"))) {
      state.setStamina(Math.max(0, state.stamina - RUN_STAMINA_COST * dt));
    }
  }
}
