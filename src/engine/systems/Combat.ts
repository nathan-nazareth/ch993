// Combat.ts — sword melee + bow ranged + damage intake.
//
// Sword: click in sword mode, hit enemies in a forward cone.
// Bow: click in bow mode, fire an arrow that travels with gravity.
// Damage: enemies in attack state deal damage during their impact
// window. Stagger with i-frames so the player can't be deleted.

import * as THREE from "three";
import { World } from "../world/World";
import { Player } from "../entities/Player";
import { Input } from "../core/Input";
import { AudioBus } from "../core/Audio";
import { GameState } from "../core/GameState";
import { Arrow } from "./Arrow";
import { Pool } from "../core/Pools";
import { MountSystem } from "./MountSystem";

const SWORD_RANGE = 4.0;
const SWORD_RANGE_SQ = SWORD_RANGE * SWORD_RANGE;
const SWORD_ARC_COS = Math.cos(Math.PI / 2);
const BOW_RANGE = 60;
const STAMINA_COST_SWORD = 12;
const STAMINA_COST_BOW = 6;
const ARROW_POOL_SIZE = 8;
const IFRAMES_AFTER_HIT_S = 0.6;
const CONTACT_RANGE_SQ = 6.76; // 2.6²

export class Combat {
  private cooldown = 0;
  private arrowPool: Pool<Arrow>;
  private activeArrows: Arrow[] = [];
  private iFrames = 0;
  private onRespawn: () => void = () => {};

  constructor(
    private world: World,
    private player: Player,
    private input: Input,
    private audio: AudioBus,
    private state: GameState,
    private mount: MountSystem,
  ) {
    this.arrowPool = new Pool<Arrow>(
      () => new Arrow(),
      (a) => a.reset(),
      ARROW_POOL_SIZE,
    );
  }

  fixedUpdate(dt: number): void {
    if (this.input.consumePressed("t")) {
      this.player.toggleWeapon();
      this.state.setWeapon(this.player.isBowDrawn() ? "bow" : "sword");
    }

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);

    if (this.input.consumeMousePressed(0) && this.cooldown <= 0 && !this.state.activeDialogue) {
      if (this.player.isBowDrawn()) {
        this.fireBow();
      } else {
        this.swingSword();
      }
    }

    if (!this.input.isMouseDown(0)) {
      // Stamina regen is owned by GameState.tickOverlays; nothing to
      // do here. The HUD is gated on actual value changes.
    }

    for (let i = this.activeArrows.length - 1; i >= 0; i--) {
      const arrow = this.activeArrows[i];
      const alive = arrow.fixedUpdate(dt, this.world);
      if (!alive) {
        this.arrowPool.release(arrow);
        this.activeArrows.splice(i, 1);
      }
    }

    this.checkEnemyContact();
  }

  private swingSword(): void {
    if (this.state.stamina < STAMINA_COST_SWORD) return;
    this.state.setStamina(this.state.stamina - STAMINA_COST_SWORD);
    this.cooldown = this.player.getWeaponCooldown();
    this.audio.swordSwing();
    this.player.triggerSwordSwing();

    // Player's "front" direction in world = (-sin(yaw), 0, -cos(yaw)).
    const forward = new THREE.Vector3(
      -Math.sin(this.player.yaw),
      0,
      -Math.cos(this.player.yaw),
    );
    const origin = this.player.group.position.clone();
    origin.y += 1.0;

    // Small forward lunge so the swing actually carries the body.
    const lunge = this.world.clampXZ(
      this.player.group.position.x + forward.x * 0.4,
      this.player.group.position.z + forward.z * 0.4,
    );
    this.player.group.position.x = lunge.x;
    this.player.group.position.z = lunge.z;
    // Only snap to ground if not airborne. On the eagle, MountSystem
    // owns the player's Y and would teleport it back next tick.
    if (!this.mount.isRiding || this.mount.currentMount !== "eagle") {
      this.player.group.position.y = this.world.heightSampler(lunge.x, lunge.z);
    }

    let hitSomething = false;
    for (const enemy of this.world.enemies) {
      if (enemy.isDead()) continue;
      const dx = enemy.group.position.x - origin.x;
      const dz = enemy.group.position.z - origin.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > SWORD_RANGE_SQ) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      if (nx * forward.x + nz * forward.z < SWORD_ARC_COS) continue;
      const killed = enemy.damage(this.player.getWeaponDamage());
      hitSomething = true;
      if (killed) {
        this.state.addKill();
      }
    }
    if (hitSomething) {
      this.audio.hit();
      this.state.flashHit();
    }
  }

  private fireBow(): void {
    if (this.state.stamina < STAMINA_COST_BOW) return;
    this.state.setStamina(this.state.stamina - STAMINA_COST_BOW);
    this.cooldown = this.player.getWeaponCooldown();
    this.audio.bowShot();

    const arrow = this.arrowPool.acquire();
    if (!arrow) return;
    arrow.onKill = () => this.state.addKill();
    const forward = new THREE.Vector3(
      -Math.sin(this.player.yaw),
      0,
      -Math.cos(this.player.yaw),
    );
    // Start the arrow at the bow's position (right hand) plus a
    // small forward offset so the arrow appears to leave the bow.
    const origin = this.player.group.position.clone();
    origin.x += forward.x * 0.5;
    origin.y += 1.3;
    origin.z += forward.z * 0.5;
    arrow.fire(origin, forward, BOW_RANGE);
    this.activeArrows.push(arrow);
    this.world.group.add(arrow.mesh);
  }

  private checkEnemyContact(): void {
    if (this.iFrames > 0) return;
    const px = this.player.group.position.x;
    const pz = this.player.group.position.z;
    for (const enemy of this.world.enemies) {
      if (enemy.isDead()) continue;
      if (!enemy.canDealDamage()) continue;
      const dx = enemy.group.position.x - px;
      const dz = enemy.group.position.z - pz;
      if (dx * dx + dz * dz > CONTACT_RANGE_SQ) continue;
      this.state.setHealth(this.state.health - enemy.getDamage());
      enemy.markSwingDelivered();
      this.iFrames = IFRAMES_AFTER_HIT_S;
      this.state.flashDamage();
      this.audio.hit();
      if (this.state.health <= 0) {
        this.respawn();
      }
      return;
    }
  }

  private respawn(): void {
    this.state.setHealth(this.state.maxHealth);
    this.player.group.position.set(0, this.world.heightSampler(0, 0), 0);
    // The mount system holds the riding flag privately. Without
    // forceDismount, the next fixedUpdate would teleport the player
    // back up to wherever the eagle was circling.
    this.mount.forceDismount();
    this.state.pushHint("You have been slain. The Eagles carry you back to the Shire.", 5000);
  }
}
