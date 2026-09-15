// MountSystem.ts — horse (default) and eagle (discovered) riding.
//
// The player starts mounted on the horse. They can dismount with Q.
// They can find and mount an eagle by approaching it. Eagle mode
// enables flight (climb with space, descend with shift).

import * as THREE from "three";
import { Input } from "../core/Input";
import { World } from "../world/World";
import { Player } from "../entities/Player";
import { GameState, Mount } from "../core/GameState";
import { AudioBus } from "../core/Audio";

const EAGLE_FLY_SPEED = 14;
const EAGLE_VERTICAL_SPEED = 6;
const HORSE_FOLLOW_DISTANCE = 1.6;

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
    this.handleToggleAndMount(dt);

    const speed = this.playerVelocity;
    if (this.riding && this.mount === "horse") {
      this.world.horse.group.position.copy(this.player.group.position);
      this.world.horse.group.position.y -= 0.3;
      this.world.horse.group.rotation.y = this.player.yaw;
      this.world.horse.fixedUpdate(dt, speed);
    } else if (this.riding && this.mount === "eagle") {
      this.applyEagleFlight(dt);
      this.world.eagle.fixedUpdate(dt, true, speed);
      // Horse stays on the ground while the player flies.
      this.world.horse.fixedUpdate(dt, 0);
    } else {
      // Not riding. The horse follows the player with a slight
      // lerp so the user can always remount with Q — no need to
      // run back to wherever they dismounted.
      const targetX = this.player.group.position.x;
      const targetZ = this.player.group.position.z;
      const horseGroup = this.world.horse.group;
      horseGroup.position.x += (targetX - horseGroup.position.x) * 0.06;
      horseGroup.position.z += (targetZ - horseGroup.position.z) * 0.06;
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

  private get playerVelocity(): number {
    return this.player.velocity.length();
  }

  private handleToggleAndMount(dt: number): void {
    if (this.input.consumePressed("q")) {
      if (this.riding && this.mount === "eagle") {
        // Dismount from the eagle and snap to the ground.
        this.riding = false;
        this.mount = "none";
        this.player.group.position.y = this.world.heightSampler(
          this.player.group.position.x,
          this.player.group.position.z,
        );
      } else if (this.riding) {
        // Dismount from the horse.
        this.riding = false;
        this.mount = "none";
      } else {
        // Remount the horse. It follows the player, so it's always
        // right here.
        this.riding = true;
        this.mount = "horse";
      }
    }
    if (this.input.consumePressed("f")) {
      const eagle = this.world.findEagle(this.player.group.position, 10);
      if (eagle) {
        if (this.riding && this.mount === "eagle") {
          this.riding = false;
          this.mount = "none";
          this.player.group.position.y = this.world.heightSampler(
            this.player.group.position.x,
            this.player.group.position.z,
          );
        } else if (!this.riding) {
          this.riding = true;
          this.mount = "eagle";
          this.state.markEagleDiscovered();
          this.audio.discovery();
        }
      }
    }
  }

  private applyEagleFlight(dt: number): void {
    let forward = 0;
    if (this.input.isDown("w")) forward += 1;
    if (this.input.isDown("s")) forward -= 1;
    let vertical = 0;
    if (this.input.isDown("space")) vertical += 1;
    if (this.input.isDown("shift")) vertical -= 1;

    const yaw = this.player.yaw;
    // The eagle faces the player's "front" direction = (-sin(yaw), 0, -cos(yaw))
    // in world. Forward input multiplies that vector.
    const dx = -Math.sin(yaw) * forward * EAGLE_FLY_SPEED * dt;
    const dz = -Math.cos(yaw) * forward * EAGLE_FLY_SPEED * dt;
    const dy = vertical * EAGLE_VERTICAL_SPEED * dt;

    const eagle = this.world.eagle.group;
    eagle.position.x += dx;
    eagle.position.z += dz;
    // Don't clamp to 2u above ground; let the player fly low enough
    // to reach ground orcs with the sword. Bottom out at groundY +
    // 1.0 so the player doesn't clip into terrain.
    const groundY = this.world.heightSampler(eagle.position.x, eagle.position.z);
    const minY = groundY + 1.0;
    eagle.position.y = Math.max(minY, eagle.position.y + dy);
    eagle.rotation.y = yaw;
    this.player.group.position.copy(eagle.position);
    this.player.group.position.y -= 1.2;
  }
}
