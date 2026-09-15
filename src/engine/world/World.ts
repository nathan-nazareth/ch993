// World.ts — the scene graph, terrain heights, and entity roster.
//
// Holds: terrain heightmap, lighting, ambient particles, NPCs, enemies.
// All public methods are read-only from outside; mutation happens in
// fixedUpdate. The world is one big THREE.Group that the engine adds
// to the scene.
//
// Performance: all geometry sharing goes through InstancedMesh
// (trees, rocks, flowers, orcs). Trees/rocks/flowers use the same
// seeded RNG as enemy spawns so the world is byte-identical across
// reloads.

import * as THREE from "three";
import { Materials } from "../render/Materials";
import { makeFlatTerrain, Geometries } from "../render/Geometries";
import { NPC } from "../entities/NPC";
import { Enemy } from "../entities/Enemy";
import { Horse } from "../entities/Horse";
import { Eagle } from "../entities/Eagle";
import { DialogueTree } from "../systems/Dialogue";
import { OrcRenderer, type OrcAssets } from "../render/OrcModel";

export const TERRAIN_SIZE = 400;
const TERRAIN_SEGMENTS = 80;
const PLAYABLE_HALF = TERRAIN_SIZE * 0.48; // soft fence inside the mesh edge

const NPC_DEFS: Array<{
  id: string;
  name: string;
  x: number;
  z: number;
  tree: DialogueTree;
}> = [
  {
    id: "old_tom",
    name: "Old Tom Cotton",
    x: 5,
    z: -3,
    tree: {
      root: {
        speaker: "Old Tom Cotton",
        text: "Good day to you, traveller! The Shire is peaceful, but word from the East is troubling.",
        choices: [
          { text: "What word from the East?", next: "word_from_east" },
          { text: "I must be going.", next: "farewell" },
        ],
      },
      nodes: {
        word_from_east: {
          speaker: "Old Tom Cotton",
          text: "Black riders, they say. Seeking something — or someone. The folk are afraid.",
          choices: [
            { text: "Then I should not linger here.", next: "farewell" },
            { text: "Tell me more of these riders.", next: "more_riders" },
          ],
        },
        more_riders: {
          speaker: "Old Tom Cotton",
          text: "They wear dark cloaks and ride black horses. None here know their purpose. Be wary.",
          choices: [{ text: "I will be.", next: "farewell" }],
        },
        farewell: {
          speaker: "Old Tom Cotton",
          text: "Safe roads, friend. And may your shadow never grow less.",
          choices: [{ text: "Farewell.", next: null }],
        },
      },
    },
  },
  {
    id: "rosie",
    name: "Rosie Cotton",
    x: -4,
    z: 6,
    tree: {
      root: {
        speaker: "Rosie Cotton",
        text: "Oh! A stranger! Have you come from Bree? They say there's trouble on the road.",
        choices: [
          { text: "I have. I am heading east.", next: "east" },
          { text: "Just passing through.", next: "passing" },
        ],
      },
      nodes: {
        east: {
          speaker: "Rosie Cotton",
          text: "East, beyond Bree? Be careful. The wild is no place for the unwary.",
          choices: [{ text: "Thank you for the warning.", next: null }],
        },
        passing: {
          speaker: "Rosie Cotton",
          text: "Well, you're welcome at the Dragon Inn, if you pass that way.",
          choices: [{ text: "I may take you up on that.", next: null }],
        },
      },
    },
  },
  {
    id: "strider",
    name: "Strider",
    x: 30,
    z: 25,
    tree: {
      root: {
        speaker: "Strider",
        text: "You walk in shadow. The road ahead is long and fraught with peril.",
        choices: [
          { text: "I go nonetheless.", next: "go_anyway" },
          { text: "Who are you?", next: "who" },
        ],
      },
      nodes: {
        go_anyway: {
          speaker: "Strider",
          text: "Then ride fast, and watch the skies for fell creatures.",
          choices: [{ text: "I will heed your words.", next: null }],
        },
        who: {
          speaker: "Strider",
          text: "A friend of the Free Peoples. That is all you need to know.",
          choices: [{ text: "Then I am glad to meet you.", next: null }],
        },
      },
    },
  },
];

export class World {
  readonly group: THREE.Group;
  readonly heightSampler: (x: number, z: number) => number;
  readonly boundsHalf: number;
  readonly npcs: NPC[] = [];
  readonly enemies: Enemy[] = [];
  readonly horse: Horse;
  readonly eagle: Eagle;

  private terrain: THREE.Mesh;
  private orcRenderer: OrcRenderer | null = null;
  private lights: { ambient: THREE.AmbientLight; sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight };
  private dialogueTrees = new Map<string, DialogueTree>();

  constructor(private scene: THREE.Scene, orcAssets?: OrcAssets) {
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.boundsHalf = PLAYABLE_HALF;

    this.lights = this.buildLights();
    this.terrain = this.buildTerrain();
    this.heightSampler = this.buildHeightSampler();
    this.buildTrees();
    this.buildRocks();
    this.buildFlowers();

    this.horse = new Horse();
    this.eagle = new Eagle();
    this.horse.group.position.set(0, this.heightSampler(0, 0), 0);
    const eagleX = 14;
    const eagleZ = -10;
    const eagleGroundY = this.heightSampler(eagleX, eagleZ);
    this.eagle.setPerch(new THREE.Vector3(eagleX, eagleGroundY + 3.5, eagleZ));
    this.group.add(this.horse.group);
    this.group.add(this.eagle.group);

    this.spawnNPCs();
    this.spawnEnemies();

    if (orcAssets) {
      this.orcRenderer = new OrcRenderer(orcAssets, this.enemies.length);
      this.group.add(this.orcRenderer.mesh);
    }
  }

  fixedUpdate(dt: number): void {
    for (const npc of this.npcs) npc.fixedUpdate(dt);
    for (const enemy of this.enemies) enemy.fixedUpdate(dt, this.playerPosition);
  }

  update(dt: number): void {
    for (const npc of this.npcs) npc.update(dt);
    for (const enemy of this.enemies) enemy.update(dt);
    this.orcRenderer?.update(this.enemies);
  }

  get playerPosition(): THREE.Vector3 {
    return this._playerPos;
  }
  private _playerPos = new THREE.Vector3();

  registerPlayerPosition(p: THREE.Vector3): void {
    this._playerPos.copy(p);
  }

  findInteractable(position: THREE.Vector3, range: number): NPC | null {
    let best: NPC | null = null;
    let bestDist = range;
    const r2 = range * range;
    for (const npc of this.npcs) {
      const dx = npc.group.position.x - position.x;
      const dz = npc.group.position.z - position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      if (d < bestDist) {
        bestDist = d;
        best = npc;
      }
    }
    return best;
  }

  findEagle(position: THREE.Vector3, range: number): Eagle | null {
    const dx = this.eagle.perch.x - position.x;
    const dz = this.eagle.perch.z - position.z;
    const r2 = range * range;
    return dx * dx + dz * dz < r2 ? this.eagle : null;
  }

  // Soft clamp: snap the player's xz inside the playable area so
  // they can't fall off the terrain mesh.
  clampXZ(x: number, z: number): { x: number; z: number } {
    const lim = this.boundsHalf;
    return {
      x: Math.max(-lim, Math.min(lim, x)),
      z: Math.max(-lim, Math.min(lim, z)),
    };
  }

  getDialogueTree(npcId: string): DialogueTree | null {
    return this.dialogueTrees.get(npcId) ?? null;
  }

  private buildLights() {
    const ambient = new THREE.AmbientLight(0x9a9a9a, 0.55);
    const sun = new THREE.DirectionalLight(0xffe8c8, 1.0);
    sun.position.set(80, 100, 60);
    const hemi = new THREE.HemisphereLight(0xb0c8e0, 0x3a4a2a, 0.45);
    this.scene.add(ambient, sun, hemi);
    return { ambient, sun, hemi };
  }

  private buildTerrain(): THREE.Mesh {
    const geo = makeFlatTerrain(TERRAIN_SIZE, TERRAIN_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.sampleHeightStatic(x, z);
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, Materials.grass);
    mesh.receiveShadow = false;
    this.group.add(mesh);

    const skyGeo = new THREE.SphereGeometry(380, 16, 12);
    const sky = new THREE.Mesh(skyGeo, Materials.sky);
    this.scene.add(sky);
    return mesh;
  }

  private sampleHeightStatic(x: number, z: number): number {
    const a = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2.0;
    const b = Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.13) * 0.8;
    const c = Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.3;
    const flat = Math.max(0, 1 - (x * x + z * z) / 40000) * 1.5;
    return a + b + c + flat - 0.5;
  }

  private buildHeightSampler(): (x: number, z: number) => number {
    return (x, z) => this.sampleHeightStatic(x, z);
  }

  private buildTrees(): void {
    const rng = makeRng(0xABCDEF);
    const tmp = new THREE.Object3D();
    const count = 80;
    const trunks = new THREE.InstancedMesh(
      Geometries.unitBox,
      Materials.treeTrunk,
      count,
    );
    const crowns = new THREE.InstancedMesh(
      Geometries.unitSphere,
      Materials.tree,
      count,
    );
    let i = 0;
    let safety = 0;
    while (i < count && safety++ < count * 4) {
      const x = (rng() - 0.5) * TERRAIN_SIZE * 0.9;
      const z = (rng() - 0.5) * TERRAIN_SIZE * 0.9;
      if (Math.hypot(x, z) < 12) continue;
      const y = this.sampleHeightStatic(x, z);
      const scale = 0.8 + rng() * 0.6;

      tmp.position.set(x, y + 0.75, z);
      tmp.scale.set(0.4, 1.5 * scale, 0.4);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      trunks.setMatrixAt(i, tmp.matrix);

      tmp.position.set(x, y + 1.5 + scale * 0.9, z);
      tmp.scale.set(scale * 1.1, scale * 1.1, scale * 1.1);
      tmp.updateMatrix();
      crowns.setMatrixAt(i, tmp.matrix);
      i++;
    }
    trunks.count = i;
    crowns.count = i;
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    this.group.add(trunks);
    this.group.add(crowns);
  }

  private buildRocks(): void {
    const rng = makeRng(0x55AA55);
    const rock = new THREE.IcosahedronGeometry(0.6, 0);
    const mesh = new THREE.InstancedMesh(rock, Materials.stone, 40);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const x = (rng() - 0.5) * TERRAIN_SIZE * 0.85;
      const z = (rng() - 0.5) * TERRAIN_SIZE * 0.85;
      const y = this.sampleHeightStatic(x, z);
      const s = 0.5 + rng() * 1.5;
      tmp.position.set(x, y + s * 0.3, z);
      tmp.scale.set(s, s * 0.6, s);
      tmp.rotation.y = rng() * Math.PI;
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  private buildFlowers(): void {
    const rng = makeRng(0x77BB77);
    const flower = new THREE.PlaneGeometry(0.3, 0.3);
    const mesh = new THREE.InstancedMesh(flower, Materials.clothingRed, 60);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < 60; i++) {
      const x = (rng() - 0.5) * TERRAIN_SIZE * 0.7;
      const z = (rng() - 0.5) * TERRAIN_SIZE * 0.7;
      const y = this.sampleHeightStatic(x, z) + 0.05;
      tmp.position.set(x, y, z);
      tmp.rotation.x = -Math.PI / 2;
      tmp.rotation.z = rng() * Math.PI;
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  private spawnNPCs(): void {
    for (const def of NPC_DEFS) {
      const y = this.sampleHeightStatic(def.x, def.z);
      const npc = new NPC({ id: def.id, name: def.name, x: def.x, y, z: def.z });
      this.npcs.push(npc);
      this.group.add(npc.group);
      this.dialogueTrees.set(def.id, def.tree);
    }
  }

  private spawnEnemies(): void {
    const rng = makeRng(0xC0FFEE);
    const ARENA = TERRAIN_SIZE * 0.45;
    const SPAWN_KEEPOUT = 14;

    for (let c = 0; c < 18; c++) {
      const cx = (rng() - 0.5) * 2 * ARENA;
      const cz = (rng() - 0.5) * 2 * ARENA;
      const size = 3 + Math.floor(rng() * 4);
      for (let j = 0; j < size; j++) {
        const angle = rng() * Math.PI * 2;
        const dist = rng() * 5;
        const x = cx + Math.cos(angle) * dist;
        const z = cz + Math.sin(angle) * dist;
        if (Math.hypot(x, z) < SPAWN_KEEPOUT) continue;
        this.spawnOrc(x, z);
      }
    }

    for (let s = 0; s < 20; s++) {
      const x = (rng() - 0.5) * 2 * ARENA;
      const z = (rng() - 0.5) * 2 * ARENA;
      if (Math.hypot(x, z) < SPAWN_KEEPOUT) continue;
      this.spawnOrc(x, z);
    }
  }

  private spawnOrc(x: number, z: number): void {
    const y = this.sampleHeightStatic(x, z);
    const e = new Enemy({ x, y, z }, this.heightSampler);
    this.enemies.push(e);
  }
}

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}