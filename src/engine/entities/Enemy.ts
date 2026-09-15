// Enemy.ts — an orc. Walks toward the player, swings at close range,
// takes damage, dies. Designed to be a real threat: the player can't
// just run forever, and the orc can definitely kill you.
//
// This class is logic + transform only: `group` (world position, and
// the tip-over rotation on death) and `body` (facing yaw, attack
// lean, walk bob). The actual mesh is the shared uruk-hai model,
// drawn for all orcs at once by OrcRenderer (one InstancedMesh).

import * as THREE from "three";

export interface EnemyDef {
  x: number;
  y: number;
  z: number;
}

// Samples the terrain height at a world position, so the orc can
// keep its feet on the ground while chasing across hills.

const AGGRO_RANGE = 40;
const ATTACK_RANGE = 2.6;
const WALK_SPEED = 3.4;
const DAMAGE = 14;
const ATTACK_COOLDOWN_S = 1.5;
const MAX_HP = 70;
const DAMAGE_BEGIN = 0.45;
const DAMAGE_END = 0.75;

type State = "idle" | "chase" | "attack" | "dead";

export class Enemy {
  readonly group: THREE.Group;
  readonly body: THREE.Group;
  private hp = MAX_HP;
  private state: State = "idle";
  private stateTimer = 0;
  stepPhase = Math.random() * Math.PI * 2;
  private hasDealtThisSwing = false;
  home: THREE.Vector3;

  constructor(
    def: EnemyDef,
    private groundHeight: (x: number, z: number) => number,
  ) {
    this.home = new THREE.Vector3(def.x, def.y, def.z);
    this.group = new THREE.Group();
    this.group.position.set(def.x, def.y, def.z);
    this.body = new THREE.Group();
    this.group.add(this.body);
  }

  fixedUpdate(dt: number, playerPos: THREE.Vector3): void {
    if (this.state === "dead") return;
    this.stateTimer += dt;

    // Anchor to the terrain under our feet every step — the orc roams
    // far from its spawn height while chasing (fixes sinking into
    // hills).
    this.group.position.y = this.groundHeight(
      this.group.position.x,
      this.group.position.z,
    );

    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);

    // Always face the player (visually rotate body so attacks land).
    if (dist > 0.1) {
      this.body.rotation.y = Math.atan2(dx, dz);
    }

    switch (this.state) {
      case "idle": {
        if (dist < AGGRO_RANGE) {
          this.state = "chase";
          this.stateTimer = 0;
        }
        break;
      }
      case "chase": {
        if (dist > AGGRO_RANGE * 1.4) {
          this.state = "idle";
          break;
        }
        if (dist < ATTACK_RANGE) {
          this.state = "attack";
          this.stateTimer = 0;
          this.hasDealtThisSwing = false;
          break;
        }
        const len = Math.max(0.001, dist);
        const vx = (dx / len) * WALK_SPEED * dt;
        const vz = (dz / len) * WALK_SPEED * dt;
        this.group.position.x += vx;
        this.group.position.z += vz;
        this.stepPhase += dt * 7;
        break;
      }
      case "attack": {
        if (dist > ATTACK_RANGE * 1.5) {
          this.state = "chase";
          this.stateTimer = 0;
          this.hasDealtThisSwing = false;
          break;
        }
        if (this.stateTimer >= ATTACK_COOLDOWN_S) {
          this.stateTimer = 0;
          this.hasDealtThisSwing = false;
        }
        break;
      }
    }
  }

  update(_dt: number): void {
    if (this.state === "dead") return;
    const speed = this.state === "chase" ? 1 : 0;
    this.body.position.y = Math.sin(this.stepPhase * 7) * 0.05 * speed;

    // Lean forward while winding up / swinging.
    if (this.state === "attack") {
      const t = this.stateTimer;
      const windup = Math.min(1, t / 0.45);
      this.body.rotation.x = windup * 0.25;
      if (t > 0.45 && t < 0.75) {
        // Strike frame: lean in sharply.
        this.body.rotation.x = 0.4 - (t - 0.45) * 1.5;
      }
    } else {
      this.body.rotation.x *= 0.85;
    }
  }

  damage(amount: number): boolean {
    if (this.state === "dead") return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.state = "dead";
      this.group.rotation.x = Math.PI / 2;
      this.body.position.set(0, 0, 0);
      this.body.rotation.set(0, 0, 0);
      this.group.position.y = this.groundHeight(
        this.group.position.x,
        this.group.position.z,
      ) - 0.2;
      return true;
    }
    this.state = "chase";
    this.stateTimer = 0;
    return false;
  }

  isDead(): boolean { return this.state === "dead"; }

  isChasing(): boolean { return this.state === "chase"; }

  // The orc deals damage once per swing, during the impact window.
  canDealDamage(): boolean {
    if (this.state !== "attack") return false;
    if (this.hasDealtThisSwing) return false;
    return this.stateTimer >= DAMAGE_BEGIN && this.stateTimer <= DAMAGE_END;
  }

  markSwingDelivered(): void {
    this.hasDealtThisSwing = true;
  }

  getDamage(): number { return DAMAGE; }
}
