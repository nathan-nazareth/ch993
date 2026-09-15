// enemy-ground.test.ts — regression test for "orcs sink into the ground".
//
// Reproduces the user report: an orc chasing a player across the
// hilly terrain must keep its feet on the ground surface, not on the
// terrain height of its spawn point. Also covers the death pose: a
// corpse must lie on the terrain where the orc died.
//
// Run with: bun test

import * as THREE from "three";
import { test, expect } from "bun:test";
import { World } from "../src/engine/world/World";
import type { Enemy } from "../src/engine/entities/Enemy";

const DT = 1 / 60;

function findOrcNearSlope(world: World): { orc: Enemy; retreatDir: THREE.Vector3 } {
  // Pick an orc with the steepest uphill direction near it. The enemy
  // layout is seeded/deterministic, so this always finds the same one.
  let best: Enemy | null = null;
  let bestSlope = 0;
  let bestDir = new THREE.Vector3(1, 0, 0);

  for (const e of world.enemies) {
    const p = e.group.position;
    const dx = world.heightSampler(p.x + 1, p.z) - world.heightSampler(p.x - 1, p.z);
    const dz = world.heightSampler(p.x, p.z + 1) - world.heightSampler(p.x, p.z - 1);
    const slope = Math.hypot(dx, dz);
    if (slope > bestSlope) {
      bestSlope = slope;
      best = e;
      bestDir = new THREE.Vector3(dx, 0, dz).normalize();
    }
  }
  if (!best) throw new Error("no orc found near a slope");
  return { orc: best, retreatDir: bestDir };
}

test("a chasing orc keeps its feet on the terrain surface", () => {
  const world = new World(new THREE.Scene());
  const { orc, retreatDir } = findOrcNearSlope(world);

  // Player retreats uphill, holding ~10 units of distance: inside
  // AGGRO_RANGE (40), outside ATTACK_RANGE (2.6), so the orc stays in
  // the chase state the whole time. This is the real call path the
  // engine uses (Player.fixedUpdate -> registerPlayerPosition).
  for (let step = 0; step < 480; step++) {
    const px = orc.group.position.x + retreatDir.x * 10;
    const pz = orc.group.position.z + retreatDir.z * 10;
    world.registerPlayerPosition(new THREE.Vector3(px, world.heightSampler(px, pz), pz));
    world.fixedUpdate(DT);

    const groundY = world.heightSampler(orc.group.position.x, orc.group.position.z);
    const drift = orc.group.position.y - groundY;
    if (Math.abs(drift) > 0.3) {
      // Fail with the worst violation we saw, not just the first.
      expect(Math.abs(drift)).toBeLessThan(0.3);
    }
  }
});

test("a dead orc lies on the terrain where it died", () => {
  const world = new World(new THREE.Scene());
  const { orc, retreatDir } = findOrcNearSlope(world);

  // Chase uphill for a while so the orc is well away from its spawn
  // height, then kill it.
  for (let step = 0; step < 240; step++) {
    const px = orc.group.position.x + retreatDir.x * 10;
    const pz = orc.group.position.z + retreatDir.z * 10;
    world.registerPlayerPosition(new THREE.Vector3(px, world.heightSampler(px, pz), pz));
    world.fixedUpdate(DT);
  }
  const groundY = world.heightSampler(orc.group.position.x, orc.group.position.z);
  const horiz = Math.hypot(orc.group.position.x - orc.home.x, orc.group.position.z - orc.home.z);
  if (horiz < 5) {
    throw new Error(`test setup failed: orc never left its spawn point (moved ${horiz})`);
  }

  orc.damage(9999);
  expect(orc.isDead()).toBe(true);
  // Death pose sinks the corpse 0.2 below its feet height; the feet
  // height must be the LOCAL terrain, not the spawn terrain.
  expect(Math.abs(orc.group.position.y - (groundY - 0.2))).toBeLessThan(0.3);
});
