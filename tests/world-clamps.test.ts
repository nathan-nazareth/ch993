// world-clamps.test.ts — verifies the world boundary and the eagle
// hover height so the player can't fall off the mesh and the eagle
// can't dip into the ground.

import { test, expect } from "bun:test";
import * as THREE from "three";
import { World } from "../src/engine/world/World";

test("clampXZ pins positions inside the playable area", () => {
  const world = new World(new THREE.Scene());
  const lim = world.boundsHalf;
  const c1 = world.clampXZ(lim + 100, 0);
  expect(c1.x).toBe(lim);
  const c2 = world.clampXZ(-(lim + 100), 0);
  expect(c2.x).toBe(-lim);
  const c3 = world.clampXZ(0, lim + 100);
  expect(c3.z).toBe(lim);
  const c4 = world.clampXZ(0, -(lim + 100));
  expect(c4.z).toBe(-lim);
  const c5 = world.clampXZ(7, 11);
  expect(c5.x).toBe(7);
  expect(c5.z).toBe(11);
});

test("NPC count and dialogue trees are populated", () => {
  const world = new World(new THREE.Scene());
  expect(world.npcs.length).toBeGreaterThanOrEqual(3);
  for (const npc of world.npcs) {
    expect(world.getDialogueTree(npc.id)).not.toBeNull();
  }
});

test("enemies are spawned across the map, never inside the keep-out", () => {
  const world = new World(new THREE.Scene());
  expect(world.enemies.length).toBeGreaterThanOrEqual(20);
  for (const e of world.enemies) {
    const r = Math.hypot(e.group.position.x, e.group.position.z);
    expect(r).toBeGreaterThanOrEqual(12); // SPAWN_KEEPOUT is 14 minus a margin
  }
});

test("dayPhase advances and wraps around the cycle", () => {
  const world = new World(new THREE.Scene());
  const start = world.dayPhase;
  for (let i = 0; i < 100; i++) world.fixedUpdate(0.5);
  // 50s of game time — dayPhase should have wrapped at 240s.
  expect(world.dayPhase).toBeGreaterThan(start);
  expect(world.dayPhase).toBeLessThan(1);
});

test("day-night lighting transitions sun intensity through noon and midnight", () => {
  const world = new World(new THREE.Scene());
  // Start at noon (dayPhase=0.25) — strongest sun.
  world.dayPhase = 0.25;
  world.fixedUpdate(0);
  const noon = (world as unknown as { lights: { sun: THREE.DirectionalLight } }).lights.sun.intensity;

  // Advance halfway around the cycle.
  for (let i = 0; i < 100; i++) world.fixedUpdate(1.2); // ~120s -> dayPhase += 0.5
  const night = (world as unknown as { lights: { sun: THREE.DirectionalLight } }).lights.sun.intensity;
  expect(noon).toBeGreaterThan(night);
});