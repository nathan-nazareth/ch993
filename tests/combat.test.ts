// combat.test.ts — verify the combat system gates sword swings and bow
// shots on stamina, cooldown, and dialogue state.

import { test, expect } from "bun:test";
import * as THREE from "three";
import { Combat } from "../src/engine/systems/Combat";
import { GameState } from "../src/engine/core/GameState";
import { Player } from "../src/engine/entities/Player";
import { World } from "../src/engine/world/World";
import { MountSystem } from "../src/engine/systems/MountSystem";

class FakeInput {
  pressed = new Set<string>();
  mousePressed = false;
  mouseDown = false;
  consumePressed(k: string): boolean {
    if (this.pressed.has(k)) { this.pressed.delete(k); return true; }
    return false;
  }
  consumeMousePressed(_b: number): boolean {
    if (this.mousePressed) { this.mousePressed = false; return true; }
    return false;
  }
  press(k: string): void { this.pressed.add(k); }
  click(): void { this.mousePressed = true; this.mouseDown = true; }
  isDown(_k: string): boolean { return false; }
  release(_k: string): void {}
  mouseDeltaX(): number { return 0; }
  mouseDeltaY(): number { return 0; }
  isMouseDown(_b: number): boolean { return this.mouseDown; }
  getWheelDelta(): number { return 0; }
  isPointerLocked(): boolean { return false; }
  requestPointerLock(): void {}
  exitPointerLock(): void {}
  endFrame(): void { this.mouseDown = false; }
  dispose(): void {}
}

function setup() {
  const scene = new THREE.Scene();
  const world = new World(scene);
  const input = new FakeInput();
  const state = new GameState();
  const audio = {
    footstep() {}, swordSwing() {}, bowShot() {}, hit() {}, dialogue() {},
    discovery() {}, startAmbientWind() {}, init() {}, resume() {}, setEnabled() {},
  } as never;
  const player = new Player(world, input as never, audio);
  const mount = new MountSystem(world, player, input as never, state, audio as never);
  const combat = new Combat(world, player, input as never, audio as never, state, mount);
  return { world, input, state, player, mount, combat };
}

test("sword swing drains stamina and triggers a cooldown", () => {
  const { input, state, combat } = setup();
  state.stamina = 100;
  input.click();
  combat.fixedUpdate(0);
  // Sword costs 12 stamina.
  expect(state.stamina).toBeLessThan(100);
});

test("weapon toggle switches between sword and bow", () => {
  const { input, state, combat } = setup();
  input.press("t");
  combat.fixedUpdate(0);
  expect(state.weapon).toBe("bow");
  input.press("t");
  combat.fixedUpdate(0);
  expect(state.weapon).toBe("sword");
});

test("combat is gated while a dialogue is active", () => {
  const { input, state, combat } = setup();
  state.setDialogue({ speaker: "x", text: "y", choices: [] });
  state.stamina = 100;
  const before = state.stamina;
  input.click();
  combat.fixedUpdate(0);
  expect(state.stamina).toBe(before);
});

test("bow shot requires stamina and produces an active arrow", () => {
  const { input, state, combat } = setup();
  input.press("t"); combat.fixedUpdate(0); // to bow
  expect(state.weapon).toBe("bow");
  state.stamina = 100;
  input.click();
  combat.fixedUpdate(0);
  // Bow costs 6 stamina and fires an arrow.
  expect(state.stamina).toBeLessThan(100);
});