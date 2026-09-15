// GameState.ts — observable game state, separate from ECS-style entities.
//
// Read by the React HUD via subscriptions. Kept small: the kind of state
// that drives the UI (health, current weapon, mount, active dialogue),
// not the per-frame world state (which lives in the engine itself).

export type Weapon = "sword" | "bow";
export type Mount = "horse" | "eagle" | "none";
export type LocationName = "Shire" | "Bree" | "Rivendell" | "Eregion" | "Moria";

export interface QuestEntry {
  id: string;
  title: string;
  description: string;
  status: "active" | "complete" | "failed";
}

export interface DialogueLine {
  speaker: string;
  text: string;
}

type Listener = () => void;

export class GameState {
  private listeners = new Set<Listener>();

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

  eaglePosition: { x: number; y: number; z: number } | null = null;
  playerPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private notify(): void {
    for (const l of this.listeners) l();
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
    this.health = Math.max(0, Math.min(this.maxHealth, h));
    this.notify();
  }

  setStamina(s: number): void {
    this.stamina = Math.max(0, Math.min(this.maxStamina, s));
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
    if (q) {
      q.status = "complete";
      this.notify();
    }
  }

  flashDamage(): void {
    this.damageFlashTime = 0.35;
    this.notify();
  }

  flashHit(): void {
    this.hitMarkerTime = 0.2;
    this.notify();
  }

  addKill(): void {
    this.kills += 1;
    this.notify();
  }

  setEaglePosition(x: number, y: number, z: number): void {
    this.eaglePosition = { x, y, z };
    // No notify here — the compass polls via the player position
    // update which notifies every frame anyway.
  }

  setPlayerPosition(x: number, y: number, z: number): void {
    this.playerPosition.x = x;
    this.playerPosition.y = y;
    this.playerPosition.z = z;
    this.notify();
  }

  tickOverlays(dt: number): void {
    if (this.damageFlashTime > 0) {
      this.damageFlashTime = Math.max(0, this.damageFlashTime - dt);
    }
    if (this.hitMarkerTime > 0) {
      this.hitMarkerTime = Math.max(0, this.hitMarkerTime - dt);
    }
  }
}
