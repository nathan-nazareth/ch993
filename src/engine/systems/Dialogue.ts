// Dialogue.ts — NPC conversation.
//
// E starts the conversation with a nearby NPC; once open, each press
// of E advances to the next choice (the first choice is the default
// and is highlighted). Pressing 1/2/3 picks a specific choice by index.
// Esc (or Q) closes the conversation.

import { World } from "../world/World";
import { Player } from "../entities/Player";
import { Input } from "../core/Input";
import { AudioBus } from "../core/Audio";
import { GameState, DialogueLine, DialogueChoice } from "../core/GameState";

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
    private audio: AudioBus,
  ) {}

  fixedUpdate(_dt: number): void {
    if (this.state.activeDialogue) {
      // Keep the speaker facing the player while in conversation.
      const npc = this.world.findInteractable(this.player.group.position, INTERACT_RANGE);
      if (npc) npc.faceTowards(this.player.group.position);

      if (this.input.consumePressed("escape")) {
        this.close();
        return;
      }
      const choice = this.readChoiceKey();
      if (choice !== null) {
        this.pick(choice);
        return;
      }
      if (this.input.consumePressed("e")) {
        this.pick(0);
      }
      return;
    }

    if (this.input.consumePressed("e")) {
      const npc = this.world.findInteractable(this.player.group.position, INTERACT_RANGE);
      if (npc) {
        this.start(npc.id);
        npc.faceTowards(this.player.group.position);
      }
    }
  }

  private readChoiceKey(): number | null {
    if (this.input.consumePressed("1")) return 0;
    if (this.input.consumePressed("2")) return 1;
    if (this.input.consumePressed("3")) return 2;
    return null;
  }

  private start(npcId: string): void {
    const tree = this.world.getDialogueTree(npcId);
    if (!tree) return;
    this.currentTree = tree;
    this.currentNodeKey = "root";
    this.speakCurrent(true);
  }

  private close(): void {
    this.currentTree = null;
    this.currentNodeKey = null;
    this.state.setDialogue(null);
  }

  private pick(choiceIndex: number): void {
    if (!this.currentTree || !this.currentNodeKey) return;
    const node = this.node(this.currentNodeKey);
    if (!node || node.choices.length === 0) {
      this.close();
      return;
    }
    const c = node.choices[Math.min(choiceIndex, node.choices.length - 1)];
    if (!c) {
      this.close();
      return;
    }
    if (c.next === null) {
      this.close();
      return;
    }
    this.currentNodeKey = c.next;
    this.speakCurrent(false);
  }

  private node(key: string): DialogueNode | null {
    if (!this.currentTree) return null;
    return key === "root" ? this.currentTree.root : this.currentTree.nodes[key] ?? null;
  }

  private speakCurrent(playSound: boolean): void {
    if (!this.currentTree || !this.currentNodeKey) return;
    const node = this.node(this.currentNodeKey);
    if (!node) {
      this.close();
      return;
    }
    const choices: DialogueChoice[] = node.choices.map((c, i) => ({
      index: i,
      text: c.text,
    }));
    const line: DialogueLine = {
      speaker: node.speaker,
      text: node.text,
      choices,
    };
    this.state.setDialogue(line);
    if (playSound) this.audio.dialogue();
  }
}