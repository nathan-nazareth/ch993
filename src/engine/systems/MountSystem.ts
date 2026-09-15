// MountSystem.ts — horse (default) and eagle (discovered) riding.
//
// The player starts mounted on the horse. They can dismount with Q.
// They can find and mount an eagle by approaching it. Eagle mode
// enables flight (climb with space, descend with shift).
//
// Performance: the horse ground-clamp uses a single height-sampler
// call. When the player is on the eagle, the horse is parked on the
// ground (NOT teleported into the sky with the player).

import { Input } from "../core/Input";
import { World } from "../world/World";
import { Player } from "../entities/Player";
import { GameState, Mount } from "../core/GameState";
import { AudioBus } from "../core/Audio";

const EAGLE_FLY_SPEED = 14;
const EAGLE_VERTICAL_SPEED = 6;
const HORSE_FOLLOW_LERP = 0.06;

export class MountSystem {
  private mount: Mount = "horse";
  private riding = true;

  constructor(
    private world: World,
    private player: Player,
    private input: Input,
    private state: GameState,
    private audio: AudioBus,
  ) {}

  fixedUpdate(dt: number): void {
    this.handleToggleAndMount();

    const speed = this.player.velocity.length();
    if (this.riding && this.mount === "horse") {
      this.world.horse.group.position.copy(this.player.group.position);
      this.world.horse.group.position.y -= 0.3;
      this.world.horse.group.rotation.y = this.player.yaw;
      this.world.horse.fixedUpdate(dt, speed);
    } else if (this.riding && this.mount === "eagle") {
      this.applyEagleFlight(dt);
      this.world.eagle.fixedUpdate(dt, true, speed);
      this.parkHorse(dt, speed);
    } else {
      const targetX = this.player.group.position.x;
      const targetZ = this.player.group.position.z;
      const horseGroup = this.world.horse.group;
      horseGroup.position.x += (targetX - horseGroup.position.x) * HORSE_FOLLOW_LERP;
      horseGroup.position.z += (targetZ - horseGroup.position.z) * HORSE_FOLLOW_LERP;
      horseGroup.position.y = this.world.heightSampler(
        horseGroup.position.x,
        horseGroup.position.z,
      );
      horseGroup.rotation.y = this.player.yaw;
      this.world.horse.fixedUpdate(dt, 0);
      this.world.eagle.fixedUpdate(dt, false, 0);
    }
  }

  get isRiding(): boolean { return this.riding; }
  get currentMount(): Mount { return this.mount; }

  setMount(m: Mount, riding: boolean): void {
    this.mount = m;
    this.riding = riding;
  }

  // Programmatic dismount used by respawn so the player doesn't
  // teleport back onto the eagle after being slain mid-flight.
  forceDismount(): void {
    if (this.riding) this.dismount();
  }

  // Keep the horse on the ground at its current xz while the player
  // rides the eagle. We don't snap it to the player because the eagle
  // can be far overhead and the player expects to remount the horse
  // where they left it, not on top of a mountain.
  private parkHorse(dt: number, speed: number): void {
    const horseGroup = this.world.horse.group;
    horseGroup.position.y = this.world.heightSampler(
      horseGroup.position.x,
      horseGroup.position.z,
    );
    horseGroup.rotation.y += dt * 0.3;
    this.world.horse.fixedUpdate(dt, speed);
  }

  private handleToggleAndMount(): void {
    if (this.input.consumePressed("q")) {
      if (this.riding && this.mount === "eagle") {
        this.dismount();
      } else if (this.riding) {
        this.dismount();
      } else {
        this.riding = true;
        this.mount = "horse";
      }
    }
    if (this.input.consumePressed("f")) {
      const eagle = this.world.findEagle(this.player.group.position, 10);
      if (!eagle) return;
      if (this.riding && this.mount === "eagle") {
        this.dismount();
      } else if (!this.riding) {
        this.riding = true;
        this.mount = "eagle";
        this.state.markEagleDiscovered();
        this.audio.discovery();
      }
    }
  }

  private dismount(): void {
    this.riding = false;
    this.mount = "none";
    this.player.group.position.y = this.world.heightSampler(
      this.player.group.position.x,
      this.player.group.position.z,
    );
  }

  private applyEagleFlight(dt: number): void {
    let forward = 0;
    if (this.input.isDown("w")) forward += 1;
    if (this.input.isDown("s")) forward -= 1;
    let vertical = 0;
    if (this.input.isDown("space")) vertical += 1;
    if (this.input.isDown("shift")) vertical -= 1;

    const yaw = this.player.yaw;
    // Forward = (-sin yaw, 0, -cos yaw), the player's facing direction
    // given Three.js's right-handed convention (object -Z is forward).
    const dx = -Math.sin(yaw) * forward * EAGLE_FLY_SPEED * dt;
    const dz = -Math.cos(yaw) * forward * EAGLE_FLY_SPEED * dt;
    const dy = vertical * EAGLE_VERTICAL_SPEED * dt;

    const eagle = this.world.eagle.group;
    eagle.position.x += dx;
    eagle.position.z += dz;
    const groundY = this.world.heightSampler(eagle.position.x, eagle.position.z);
    const minY = groundY + 1.0;
    eagle.position.y = Math.max(minY, eagle.position.y + dy);
    eagle.rotation.y = yaw;
    this.player.group.position.copy(eagle.position);
    this.player.group.position.y -= 1.2;
  }
}