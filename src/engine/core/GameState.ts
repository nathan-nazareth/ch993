// GameState.ts — observable game state, separate from ECS-style entities.
//
// Read by the React HUD via subscriptions. Kept small: the kind of state
// that drives the UI (health, current weapon, mount, active dialogue),
// not the per-frame world state (which lives in the engine itself).
//
// Performance note: every setter that drives React render gates its
// notify() on a meaningful change. The position field is published on a
// separate channel that is cheap to poll, so it doesn't re-render the
// HUD 60 times a second.

export type Weapon = "sword" | "bow";
export type Mount = "horse" | "eagle" | "none";
export type LocationName = "Shire" | "Bree" | "Rivendell" | "Eregion" | "Moria";

export interface QuestEntry {
  id: string;
  title: string;
  description: string;
  status: "active" | "complete" | "failed";
}

export interface DialogueChoice {
  index: number;
  text: string;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  choices: DialogueChoice[];
}

export interface PositionInfo {
  x: number;
  y: number;
  z: number;
}

type Listener = () => void;

const EPSILON = 0.0001;
const REGEN_DELAY_AFTER_HIT_S = 5;
const REGEN_PER_S = 4;
const STAMINA_REGEN_PER_S = 18;

export class GameState {
  private listeners = new Set<Listener>();
  private positionListeners = new Set<Listener>();

  health = 100;
  maxHealth = 100;
  stamina = 100;
  maxStamina = 100;

  weapon: Weapon = "sword";
  mount: Mount = "horse";

  currentLocation: LocationName = "Shire";
  discoveredEagle = false;

  activeDialogue: DialogueLine | null = null;
  quests: QuestEntry[] = [
    {
      id: "main_journey",
      title: "The Journey Begins",
      description: "Travel from the Shire toward Rivendell.",
      status: "active",
    },
  ];

  recentHints: string[] = [];

  damageFlashTime = 0;
  hitMarkerTime = 0;
  kills = 0;

  eaglePosition: PositionInfo | null = null;
  playerPosition: PositionInfo = { x: 0, y: 0, z: 0 };

  private timeSinceLastDamage = 999;

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  subscribePosition(l: Listener): () => void {
    this.positionListeners.add(l);
    return () => this.positionListeners.delete(l);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private notifyPosition(): void {
    for (const l of this.positionListeners) l();
  }

  setWeapon(w: Weapon): void {
    if (this.weapon === w) return;
    this.weapon = w;
    this.notify();
  }

  setMount(m: Mount): void {
    if (this.mount === m) return;
    this.mount = m;
    this.notify();
  }

  setHealth(h: number): void {
    const clamped = Math.max(0, Math.min(this.maxHealth, h));
    if (clamped === this.health) return;
    this.health = clamped;
    if (clamped < this.health || h < clamped) this.timeSinceLastDamage = 0;
    this.notify();
  }

  setStamina(s: number): void {
    const clamped = Math.max(0, Math.min(this.maxStamina, s));
    if (clamped === this.stamina) return;
    this.stamina = clamped;
    this.notify();
  }

  setLocation(loc: LocationName): void {
    if (this.currentLocation === loc) return;
    this.currentLocation = loc;
    this.notify();
  }

  pushHint(text: string, ttlMs = 4000): void {
    this.recentHints.push(text);
    this.notify();
    setTimeout(() => {
      const i = this.recentHints.indexOf(text);
      if (i !== -1) this.recentHints.splice(i, 1);
      this.notify();
    }, ttlMs);
  }

  setDialogue(d: DialogueLine | null): void {
    this.activeDialogue = d;
    this.notify();
  }

  markEagleDiscovered(): void {
    if (this.discoveredEagle) return;
    this.discoveredEagle = true;
    this.notify();
  }

  completeQuest(id: string): void {
    const q = this.quests.find((x) => x.id === id);
    if (!q || q.status === "complete") return;
    q.status = "complete";
    this.notify();
  }

  flashDamage(): void {
    this.damageFlashTime = 0.35;
    this.timeSinceLastDamage = 0;
    this.notify();
  }

  flashHit(): void {
    this.hitMarkerTime = 0.2;
    this.notify();
  }

  addKill(): void {
    this.kills += 1;
    this.notify();
    if (this.kills >= 10) this.completeQuest("main_journey");
  }

  setEaglePosition(x: number, y: number, z: number): void {
    const p = this.eaglePosition;
    if (
      p &&
      Math.abs(p.x - x) < EPSILON &&
      Math.abs(p.y - y) < EPSILON &&
      Math.abs(p.z - z) < EPSILON
    ) return;
    this.eaglePosition = { x, y, z };
  }

  setPlayerPosition(x: number, y: number, z: number): void {
    const p = this.playerPosition;
    if (
      Math.abs(p.x - x) < 0.05 &&
      Math.abs(p.y - y) < 0.05 &&
      Math.abs(p.z - z) < 0.05
    ) return;
    p.x = x; p.y = y; p.z = z;
    this.notifyPosition();
  }

  tickOverlays(dt: number): void {
    let overlaysChanged = false;
    if (this.damageFlashTime > 0) {
      this.damageFlashTime = Math.max(0, this.damageFlashTime - dt);
      overlaysChanged = true;
    }
    if (this.hitMarkerTime > 0) {
      this.hitMarkerTime = Math.max(0, this.hitMarkerTime - dt);
      overlaysChanged = true;
    }
    this.timeSinceLastDamage += dt;

    if (
      this.timeSinceLastDamage > REGEN_DELAY_AFTER_HIT_S &&
      this.health < this.maxHealth
    ) {
      this.health = Math.min(this.maxHealth, this.health + REGEN_PER_S * dt);
      overlaysChanged = true;
    }

    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(
        this.maxStamina,
        this.stamina + STAMINA_REGEN_PER_S * dt,
      );
      overlaysChanged = true;
    }

    if (overlaysChanged) this.notify();
  }
}