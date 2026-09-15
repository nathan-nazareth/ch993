# Fellowship of the Ring: 3D Adventure

A 3D Lord-of-the-Rings adventure in the browser. Fresh from-scratch
code, no assets, runs on CPU-only devices.

## What it is

A small (~2,400 lines of TypeScript/TSX) third-person 3D game where
you play a hero of the Free Peoples:

- Walk, run, ride a horse (Shadowfax) across procedurally generated
  Middle-earth terrain
- Toggle between **sword** (Andúril) and **bow** (Bow of Lórien) with
  `T` to engage orcs at close or long range
- Find and mount a **Great Eagle** with `F`, then fly above the
  landscape — `W`/`S` for forward/back, `Space`/`Shift` to climb/descend
- Talk to hobbits, rangers, and other folk with `E`
- Dismount with `Q`
- Health and stamina bars; health regen after a brief lull
- Ambient wind, sword swings, bow releases, footfalls, dialogue
  chirps — all synthesised at runtime with the Web Audio API
- The whole geometry is procedural: boxes and spheres assembled into
  a hero, horse, eagle, NPCs, enemies, trees, rocks, flowers, a
  hill-scape sky-dome

## Source-of-truth: inspired, not copied

Architecture ideas borrowed from the star-wars engine
(`/home/nathan/dev/star-wars/`):

- Fixed-step simulation with accumulator and spiral-of-death cap
- Object pools for short-lived objects (arrows)
- Shared geometry + shared materials across all entities
- DPR cap for CPU-first rendering
- Soft-shadow-free lighting (a single ambient + directional + hemi)
- Procedural audio synthesised at runtime instead of sample buffers
- Fog that hides distant geometry

But **none of the star-wars code is reused**. The engine here is a
clean, from-scratch TypeScript implementation: 27 source files, 2,391
lines.

## Run it

```
npm install
npm run dev      # http://127.0.0.1:5173/
npm run build    # production bundle in dist/
npm run typecheck
```

`npm run dev` is the fastest way to play. Click "Begin the Journey",
then `Click to begin` again to acquire pointer lock.

## Controls

| Key | Action |
|---|---|
| `WASD` | Walk / ride |
| `Shift` (hold) | Run / gallop |
| `Mouse` | Look around |
| `Click` | Attack (sword swing or bow shot) |
| `T` | Toggle sword ↔ bow |
| `E` | Talk to a nearby NPC |
| `Q` | Dismount / remount horse |
| `F` | Mount or dismount a nearby eagle |
| `Space` | Climb (eagle) |
| `Esc` | Back to menu / close dialogue |

## File map

```
ch992/
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
├── index.html
├── .eslintrc.json
├── README.md
└── src/
    ├── main.tsx              # React entry
    ├── App.tsx               # menu / game state machine
    ├── styles/
    │   ├── theme.css         # LOTR palette + Google Fonts
    │   └── layout.css        # UI primitives
    ├── engine/
    │   ├── core/
    │   │   ├── Engine.ts     # main loop, fixed-step
    │   │   ├── Input.ts      # keyboard / mouse / pointer lock
    │   │   ├── Audio.ts      # Web Audio synthesis
    │   │   ├── GameState.ts  # observable HUD state
    │   │   └── Pools.ts      # object pool
    │   ├── render/
    │   │   ├── Renderer.ts   # WebGLRenderer + DPR cap
    │   │   ├── Materials.ts  # shared MeshLambertMaterials
    │   │   └── Geometries.ts # shared BoxGeometry / Sphere
    │   ├── world/
    │   │   └── World.ts      # terrain, trees, rocks, NPCs, enemies
    │   ├── entities/
    │   │   ├── Player.ts     # hero body + weapon + movement
    │   │   ├── Horse.ts      # Shadowfax
    │   │   ├── Eagle.ts      # great eagle mount
    │   │   ├── NPC.ts        # hobbits, rangers
    │   │   └── Enemy.ts      # orc melee AI
    │   └── systems/
    │       ├── Camera.ts       # third-person follow + mouse-look
    │       ├── MovementSystem.ts # WASD + run stamina
    │       ├── MountSystem.ts  # horse + eagle riding
    │       ├── Combat.ts       # sword melee + bow ranged
    │       ├── Arrow.ts        # pooled projectile
    │       └── Dialogue.ts     # NPC conversation tree
    └── ui/
        ├── GameView.tsx      # mounts canvas + engine
        ├── HUD.tsx           # health / stamina / weapon / mount / quests
        ├── DialogueBox.tsx   # bottom-center dialogue
        ├── MainMenu.tsx      # title + credits
        └── useGameState.ts   # hook into GameState
```

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | ✓ 0 errors |
| `npm run build` | ✓ 3.66s, 4 chunks |
| `npm run dev` (live) | ✓ serves on `http://127.0.0.1:5173/` |

The dev server returns 200 for the HTML, the main module, the engine,
and the movement system. All Vite transformations succeed.

## What's in scope for next iterations

1. **Multi-region map.** Right now everything is in the Shire area.
   Add Rivendell, Moria, Mordor as separate sub-scenes with their own
   terrain seeds and NPC rosters.
2. **Quest log progression.** "Reach Rivendell" / "Cross Moria" /
   "Confront the Balrog" all driven off the GameState.
3. **Save/load.** `localStorage` snapshot of position, health, quests,
   discovered eagle. The `Storage.ts` module is the seam.
4. **Better dialogue branching.** Currently the tree is read once and
   the player's choice advances linearly. Add a real choice selector
   with arrow keys.
5. **Day/night cycle.** A single DirectionalLight + sun angle driven
   by elapsed time gives huge atmosphere for ~20 lines.
6. **Sound design depth.** Right now each cue is one oscillator.
   Layered synthesis (multiple oscillators, envelopes, spatial
   positioning) would lift the audio from "functional" to "epic".
7. **Enemy variety.** Orcs → wargs (mounted, faster, lower HP), uruk-hai
   (heavier, slower, more damage), fell beasts (flying).
8. **Mounted combat.** Right click while riding to swing the sword
   in the horse's gait direction.
