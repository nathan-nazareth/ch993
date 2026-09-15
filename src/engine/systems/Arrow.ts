// Arrow.ts — pooled arrow projectile. Travels forward and falls under
// gravity. Collides with terrain or enemies.

import * as THREE from "three";
import { Geometries } from "../render/Geometries";
import { Materials } from "../render/Materials";
import { World } from "../world/World";

const SPEED = 60;
const MAX_LIFE_S = 2.5;
const DAMAGE = 100;

export class Arrow {
  readonly mesh: THREE.Mesh;
  onKill: (() => void) | null = null;
  private velocity = new THREE.Vector3();
  private life = 0;
  private maxLife = 3;
  private active = false;

  constructor() {
    this.mesh = new THREE.Mesh(Geometries.unitBox, Materials.arrow);
    this.mesh.scale.set(0.08, 0.08, 1.0);
    this.mesh.visible = false;
  }

  fire(origin: THREE.Vector3, direction: THREE.Vector3, _range: number): void {
    this.mesh.position.copy(origin);
    this.velocity.copy(direction).multiplyScalar(SPEED);
    this.life = 0;
    this.maxLife = MAX_LIFE_S;
    this.active = true;
    this.mesh.visible = true;
    const yaw = Math.atan2(direction.x, direction.z);
    this.mesh.rotation.set(0, yaw, Math.PI / 2);
  }

  reset(): void {
    this.active = false;
    this.mesh.visible = false;
    this.velocity.set(0, 0, 0);
  }

  fixedUpdate(dt: number, world: World): boolean {
    if (!this.active) return false;
    this.life += dt;
    if (this.life > this.maxLife) return false;
    // Straight-line travel — no gravity, so an arrow you aim at an
    // orc actually hits it, including from eagle-back.
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.y += this.velocity.y * dt;
    this.mesh.position.z += this.velocity.z * dt;

    for (const enemy of world.enemies) {
      if (enemy.isDead()) continue;
      // Sphere check around the enemy body, generous radius so the
      // bow feels reliable.
      const d = enemy.group.position.distanceTo(this.mesh.position);
      if (d < 1.8) {
        const killed = enemy.damage(DAMAGE);
        if (killed) {
          this.onKill?.();
        }
        this.stick();
        return false;
      }
    }

    return true;
  }

  private stick(): void {
    this.active = false;
    this.mesh.visible = false;
  }
}
