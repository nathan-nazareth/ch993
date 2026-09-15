// Engine.ts — main game loop and scene orchestration.
//
// Fixed-step simulation with variable-step rendering. Inspired by the
// classic "Glenn Fiedler" pattern but written from scratch. This is
// NOT a copy of the star-wars engine — it's a smaller, simpler version
// tuned for one-player exploration and combat.

import * as THREE from "three";
import { Input } from "./Input";
import { Renderer } from "../render/Renderer";
import { World } from "../world/World";
import { Player } from "../entities/Player";
import { MountSystem } from "../systems/MountSystem";
import { Camera } from "../systems/Camera";
import { Combat } from "../systems/Combat";
import { Dialogue } from "../systems/Dialogue";
import { MovementSystem } from "../systems/MovementSystem";
import { AudioBus } from "./Audio";
import { GameState } from "./GameState";
import type { OrcAssets } from "../render/OrcModel";

const FIXED_STEP_S = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

export class Engine {
  readonly scene: THREE.Scene;
  readonly world: World;
  readonly input: Input;
  readonly audio: AudioBus;
  readonly player: Player;
  readonly mountSystem: MountSystem;
  readonly cameraSystem: Camera;
  readonly combat: Combat;
  readonly dialogue: Dialogue;
  readonly movement: MovementSystem;
  readonly state: GameState;
  readonly renderer: Renderer;

  private rafId: number | null = null;
  private lastTimeMs = 0;
  private accumulator = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, orcAssets?: OrcAssets) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x4a5a6a, 80, 280);

    this.input = new Input(canvas);
    this.audio = new AudioBus();
    this.state = new GameState();

    this.renderer = new Renderer(canvas, this.scene);
    this.world = new World(this.scene, orcAssets);
    this.player = new Player(this.world, this.input, this.audio);
    this.mountSystem = new MountSystem(this.world, this.player, this.input, this.state, this.audio);
    this.cameraSystem = new Camera(this.renderer.camera, this.input, this.player, this.mountSystem);
    this.combat = new Combat(this.world, this.player, this.input, this.audio, this.state);
    this.dialogue = new Dialogue(this.player, this.world, this.input, this.state);
    this.movement = new MovementSystem(this.player, this.input, this.mountSystem);

    this.scene.add(this.player.group);
    this.player.group.position.copy(this.world.horse.group.position);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = performance.now();
    this.accumulator = 0;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.input.dispose();
    this.renderer.dispose();
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const now = performance.now();
    let frameDelta = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    if (frameDelta > 0.25) frameDelta = 0.25;
    this.accumulator += frameDelta;

    let steps = 0;
    while (this.accumulator >= FIXED_STEP_S && steps < MAX_STEPS_PER_FRAME) {
      this.fixedUpdate(FIXED_STEP_S);
      this.accumulator -= FIXED_STEP_S;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) {
      this.accumulator = 0;
    }

    this.renderUpdate(frameDelta);
    this.renderer.render();
    this.input.endFrame();
  };

  private fixedUpdate(dt: number): void {
    this.movement.fixedUpdate(dt, this.state);
    this.player.fixedUpdate(dt);
    this.mountSystem.fixedUpdate(dt);
    this.world.fixedUpdate(dt);
    this.combat.fixedUpdate(dt);
    this.dialogue.fixedUpdate(dt);
    this.state.tickOverlays(dt);
    this.publishPositions();
  }

  private publishPositions(): void {
    this.state.setPlayerPosition(
      this.player.group.position.x,
      this.player.group.position.y,
      this.player.group.position.z,
    );
    this.state.setEaglePosition(
      this.world.eagle.perch.x,
      this.world.eagle.perch.y,
      this.world.eagle.perch.z,
    );
  }

  private renderUpdate(_dt: number): void {
    this.cameraSystem.update();
    this.world.update(_dt);
  }
}
