// game-state.test.ts — verifies the GameState change-detection guards
// so the HUD doesn't re-render when nothing meaningful changed.

import { test, expect } from "bun:test";
import { GameState } from "../src/engine/core/GameState";

test("setHealth only notifies when value changes", () => {
  const state = new GameState();
  let calls = 0;
  state.subscribe(() => calls++);
  state.setHealth(80);
  state.setHealth(80); // no-op
  expect(calls).toBe(1);
  state.setHealth(81);
  expect(calls).toBe(2);
});

test("setStamina only notifies when value changes", () => {
  const state = new GameState();
  let calls = 0;
  state.subscribe(() => calls++);
  state.setStamina(50);
  state.setStamina(50);
  expect(calls).toBe(1);
});

test("setPlayerPosition only notifies the position channel, not the slow channel", () => {
  const state = new GameState();
  let slow = 0, fast = 0;
  state.subscribe(() => slow++);
  state.subscribePosition(() => fast++);
  state.setPlayerPosition(1, 2, 3);
  state.setPlayerPosition(1, 2, 3); // unchanged -> no notify
  state.setPlayerPosition(2, 2, 3);
  expect(slow).toBe(0);
  expect(fast).toBe(2);
});

test("tickOverlays regens health after a lull, drains when recently hit", () => {
  const state = new GameState();
  state.health = 50;
  state.flashDamage(); // timeSinceLastDamage = 0
  for (let i = 0; i < 100; i++) state.tickOverlays(0.1); // 10s
  // 5s lull + 5s of regen @ 4 hp/s = +20 hp
  expect(state.health).toBeGreaterThanOrEqual(70);
  expect(state.health).toBeLessThanOrEqual(72);
});

test("addKill auto-completes the first quest at 10 kills", () => {
  const state = new GameState();
  for (let i = 0; i < 9; i++) state.addKill();
  expect(state.quests[0].status).toBe("active");
  state.addKill();
  expect(state.quests[0].status).toBe("complete");
});