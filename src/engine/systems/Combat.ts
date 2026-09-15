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

const SWORD_RANGE = 4.0;
const SWORD_ARC_COS = Math.cos(Math.PI / 2);
const BOW_RANGE = 60;
const STAMINA_COST_SWORD = 12;
const STAMINA_COST_BOW = 6;
const STAMINA_REGEN_PER_S = 18;
const ARROW_POOL_SIZE = 8;
const IFRAMES_AFTER_HIT_S = 0.6;

export class Combat {
  private cooldown = 0;
  private arrowPool: Pool<Arrow>;
  private activeArrows: Arrow[] = [];
  private iFrames = 0;

  constructor(
    private world: World,
    private player: Player,
    private input: Input,
    private audio: AudioBus,
    private state: GameState,
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
      this.state.setStamina(this.state.stamina + STAMINA_REGEN_PER_S * dt);
    }

    for (let i = this.activeArrows.length - 1; i >= 0; i--) {
      const arrow = this.activeArrows[i];
      const alive = arrow.fixedUpdate(dt, this.world);
      if (!alive) {
        this.arrowPool.release(arrow);
        this.activeArrows.splice(i, 1);
      }
    }

    this.checkEnemyContact(dt);
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
    this.player.group.position.x += forward.x * 0.4;
    this.player.group.position.z += forward.z * 0.4;
    this.player.group.position.y = this.world.heightSampler(
      this.player.group.position.x,
      this.player.group.position.z,
    );

    let hitSomething = false;
    for (const enemy of this.world.enemies) {
      if (enemy.isDead()) continue;
      const toEnemy = enemy.group.position.clone().sub(origin);
      toEnemy.y = 0;
      const d = toEnemy.length();
      if (d > SWORD_RANGE) continue;
      toEnemy.normalize();
      if (toEnemy.dot(forward) < SWORD_ARC_COS) continue;
      const killed = enemy.damage(this.player.getWeaponDamage());
      hitSomething = true;
      if (killed) {
        this.audio.hit();
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

  private checkEnemyContact(_dt: number): void {
    if (this.iFrames > 0) return;
    for (const enemy of this.world.enemies) {
      if (enemy.isDead()) continue;
      if (!enemy.canDealDamage()) continue;
      const d = enemy.group.position.distanceTo(this.player.group.position);
      if (d < 2.6) {
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
  }

  private respawn(): void {
    this.state.setHealth(this.state.maxHealth);
    this.player.group.position.set(0, this.world.heightSampler(0, 0), 0);
    this.state.pushHint("You have been slain. The Eagles carry you back to the Shire.", 5000);
  }
}
