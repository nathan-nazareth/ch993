// dialogue-tree.test.ts — verifies that the dialogue system actually
// walks the branches and surfaces choices to the player.

import { test, expect } from "bun:test";
import * as THREE from "three";
import { Dialogue } from "../src/engine/systems/Dialogue";
import { Player } from "../src/engine/entities/Player";
import { GameState } from "../src/engine/core/GameState";
import { World } from "../src/engine/world/World";
import { AudioBus } from "../src/engine/core/Audio";

class FakeInput {
  pressed: Set<string> = new Set();
  consumePressed(k: string): boolean {
    if (this.pressed.has(k)) {
      this.pressed.delete(k);
      return true;
    }
    return false;
  }
  consumeMousePressed(_b: number): boolean { return false; }
  press(k: string): void { this.pressed.add(k); }
  // Methods used by Dialogue/Player that we don't exercise here:
  isDown(_k: string): boolean { return false; }
  release(_k: string): void {}
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

function setup() {
  const scene = new THREE.Scene();
  const world = new World(scene);
  const player = new Player(world, new FakeInput() as never, {} as AudioBus);
  player.group.position.set(5, world.heightSampler(5, -3), -3);
  const input = new FakeInput();
  const state = new GameState();
  const audio = { dialogue() {} } as unknown as AudioBus;
  const dialogue = new Dialogue(player, world, input as never, state, audio);
  return { world, player, input, state, dialogue };
}

test("dialogue tree branches advance when player picks a choice", () => {
  const { world, input, state, dialogue } = setup();
  void world;
  input.press("e");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue).not.toBeNull();
  expect(state.activeDialogue!.speaker).toBe("Old Tom Cotton");
  expect(state.activeDialogue!.choices.length).toBe(2);

  input.press("1");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue).not.toBeNull();
  expect(state.activeDialogue!.text).toMatch(/Black riders/);
  expect(state.activeDialogue!.choices.length).toBe(2);

  input.press("2");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue!.text).toMatch(/dark cloaks/);

  // more_riders has one choice "I will be." -> farewell (a non-null node).
  input.press("1");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue!.text).toMatch(/Safe roads/);

  // farewell has one choice "Farewell." -> next: null -> closes dialogue.
  input.press("1");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue).toBeNull();
});

test("E advances to the default (first) choice", () => {
  const { input, state, dialogue } = setup();
  input.press("e");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue!.text).toMatch(/peaceful/);

  input.press("e");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue!.text).toMatch(/Black riders/);
});

test("Esc closes the dialogue", () => {
  const { input, state, dialogue } = setup();
  input.press("e");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue).not.toBeNull();

  input.press("escape");
  dialogue.fixedUpdate(0);
  expect(state.activeDialogue).toBeNull();
});