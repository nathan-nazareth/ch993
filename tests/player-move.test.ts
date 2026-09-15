// player-move.test.ts — basic coverage for the player's movement
// direction math and walk cycle bookkeeping.

import { test, expect } from "bun:test";
import * as THREE from "three";
import { Player } from "../src/engine/entities/Player";
import { World } from "../src/engine/world/World";
import { GameState } from "../src/engine/core/GameState";

class FakeInput {
  private map = new Map<string, boolean>();
  isDown(k: string): boolean { return this.map.get(k) ?? false; }
  press(k: string): void { this.map.set(k, true); }
  release(k: string): void { this.map.delete(k); }
  consumePressed(_k: string): boolean { return false; }
  consumeMousePressed(_b: number): boolean { return false; }
  mouseDeltaX(): number { return 0; }
  mouseDeltaY(): number { return 0; }
  isMouseDown(_b: number): boolean { return false; }
  getWheelDelta(): number { return 0; }
  isPointerLocked(): boolean { return false; }
  requestPointerLock(): void {}
  exitPointerLock(): void {}
  endFrame(): void {}
  dispose(): void {}
}

function setupPlayer() {
  const scene = new THREE.Scene();
  const world = new World(scene);
  const input = new FakeInput();
  const state = new GameState();
  const audio = {
    footstep() {}, swordSwing() {}, bowShot() {}, hit() {}, dialogue() {},
    discovery() {}, startAmbientWind() {}, init() {}, resume() {}, setEnabled() {},
  } as never;
  const player = new Player(world, input as never, audio);
  return { world, input, player };
}

test("W with yaw=0 yields -Z forward direction", () => {
  const { input, player } = setupPlayer();
  input.press("w");
  const { dir } = player.getMoveDir(0, false);
  expect(dir.x).toBeCloseTo(0, 5);
  expect(dir.z).toBeCloseTo(-1, 5);
});

test("D with yaw=0 yields +X right direction", () => {
  const { input, player } = setupPlayer();
  input.press("d");
  const { dir } = player.getMoveDir(0, false);
  expect(dir.x).toBeCloseTo(1, 5);
  expect(dir.z).toBeCloseTo(0, 5);
});

test("W with yaw=π/2 yields -X forward direction", () => {
  const { input, player } = setupPlayer();
  input.press("w");
  const { dir } = player.getMoveDir(Math.PI / 2, false);
  expect(dir.x).toBeCloseTo(-1, 5);
  expect(dir.z).toBeCloseTo(0, 5);
});

test("no keys yields zero direction", () => {
  const { player } = setupPlayer();
  const { dir, speed } = player.getMoveDir(0, false);
  expect(dir.length()).toBe(0);
  expect(speed).toBe(0);
});

test("applyMovement is clamped to world bounds", () => {
  const { world, player } = setupPlayer();
  // Park the player at the +X edge and try to walk further out.
  player.group.position.set(world.boundsHalf - 1, 0, 0);
  const moveDir = new THREE.Vector3(1, 0, 0);
  player.applyMovement(moveDir, 10, 5, false);
  expect(player.group.position.x).toBeLessThanOrEqual(world.boundsHalf);
  expect(player.group.position.x).toBeGreaterThanOrEqual(-world.boundsHalf);
});

test("walkPhase decays when stationary", () => {
  const { player } = setupPlayer();
  player.walkPhase = 1;
  player.applyMovement(new THREE.Vector3(), 0, 0.1, false);
  expect(player.walkPhase).toBeLessThan(1);
});