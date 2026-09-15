// Dialogue.ts — NPC conversation. E to start/continue. Esc to close.
// Walks a small dialogue tree (one root, a few branches).

import * as THREE from "three";
import { World } from "../world/World";
import { Player } from "../entities/Player";
import { Input } from "../core/Input";
import { GameState, DialogueLine } from "../core/GameState";

export interface DialogueNode {
  speaker: string;
  text: string;
  choices: Array<{ text: string; next: string | null }>;
}

export interface DialogueTree {
  root: DialogueNode;
  nodes: Record<string, DialogueNode>;
}

const INTERACT_RANGE = 4.0;

export class Dialogue {
  private currentTree: DialogueTree | null = null;
  private currentNodeKey: string | null = null;

  constructor(
    private player: Player,
    private world: World,
    private input: Input,
    private state: GameState,
  ) {}

  fixedUpdate(_dt: number): void {
    if (this.state.activeDialogue) {
      if (this.input.consumePressed("e") || this.input.consumePressed("escape")) {
        this.close();
      }
      return;
    }

    if (this.input.consumePressed("e")) {
      const npc = this.world.findInteractable(this.player.group.position, INTERACT_RANGE);
      if (npc) {
        this.start(npc.id);
      }
    }
  }

  private start(npcId: string): void {
    const tree = this.world.getDialogueTree(npcId);
    if (!tree) return;
    this.currentTree = tree;
    this.currentNodeKey = "root";
    this.speakCurrent();
  }

  private close(): void {
    this.currentTree = null;
    this.currentNodeKey = null;
    this.state.setDialogue(null);
  }

  private speakCurrent(): void {
    if (!this.currentTree || !this.currentNodeKey) return;
    const node =
      this.currentNodeKey === "root"
        ? this.currentTree.root
        : this.currentTree.nodes[this.currentNodeKey];
    if (!node) {
      this.close();
      return;
    }
    const line: DialogueLine = { speaker: node.speaker, text: node.text };
    this.state.setDialogue(line);
  }
}
