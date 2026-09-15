# Fellowship of the Ring: 3D Adventure (ch993)

A 3D Lord-of-the-Rings adventure in the browser. Fresh from-scratch
code, no assets, runs on CPU-only devices.

This is the bug-fix / optimisation rebuild of [ch992](../ch992).
Everything that was wrong has been corrected; everything that was
slow has been tuned.

## What's in the game

- Walk, run, ride a horse (Shadowfax) across procedurally generated
  Middle-earth terrain
- Toggle between **sword** (Andúril) and **bow** (Bow of Lórien) with
  `T` to engage orcs at close or long range
- Find and mount a **Great Eagle** with `F`, then fly above the
  landscape — `W`/`S` for forward/back, `Space`/`Shift` to climb/descend
- Talk to hobbits, rangers, and other folk with `E`; **choose your
  replies with `1`/`2`/`3`** (or `E` for the first option)
- Dismount with `Q`
- Health regenerates after 5 seconds out of combat; stamina regens
  passively
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
clean, from-scratch TypeScript implementation.

## What changed from ch992

### Bug fixes

| # | Bug | Fix |
|---|-----|-----|
| 1 | `setPlayerPosition` notified all React subscribers every frame, forcing the HUD to re-render 60×/s for no UI change | Split GameState into a slow channel (HP/stam/weapon/mount/dialogue/quests) and a fast position channel; every setter gates `notify()` on a real value change; HUD position subscribers read via refs and mutate the DOM directly |
| 2 | Dialogue choices were defined in trees but never walked — `E` only closed the dialogue | Dialogue now walks the tree: `E` advances to the default (first) choice, `1`/`2`/`3` picks a specific choice, `Esc` closes |
| 3 | Horse was teleported into the sky whenever the player rode the eagle | MountSystem now `parkHorse()` while eagle-mounted, keeping the horse on the ground at its last known xz |
| 4 | Dying while eagle-mounted respawned the player at the origin but left the mount state intact, so the next tick teleported them back up to the eagle | Combat takes the MountSystem and calls `forceDismount()` on respawn |
| 5 | ESLint v10 couldn't read the legacy `.eslintrc.json` (`npm run lint` failed) | New flat `eslint.config.js` with `typescript-eslint` |
| 6 | Player could walk off the terrain mesh and fall into the void | World exposes `clampXZ()` and the player and sword lunge use it |
| 7 | Player on the eagle could trigger NPC dialogue from directly above | `findInteractable` now checks `|dy| < 2.5` in addition to xz range |
| 8 | Enemy `stepPhase` was incremented in both `fixedUpdate` and `update`, doubling the walk cycle | Removed the redundant increment; `fixedUpdate` is the single source |
| 9 | Tree/rock/flower placement used `Math.random()` (different on every reload) | Each subsystem uses its own seeded Mulberry32 RNG, so the world is byte-identical across reloads |
| 10 | Dying corpse was offset by the bob phase from the last chase step | `damage()` resets `body.position` and `body.rotation` to zero on death |
| 11 | `MainMenu` had an `onCredits` prop that was never called | Prop is kept for API stability but the menu now uses local credits overlay |
| 12 | `MovementSystem` raced with `GameState.tickOverlays` for stamina regen, causing UI flicker | Regen is owned by `GameState` only; `MovementSystem` only drains |
| 13 | AudioContext was created in an async callback, so it could be created suspended with no resume path | `GameView` listens for `pointerdown` and calls `engine.audio.resume()` |

### CPU optimisations

- `GameState.setPlayerPosition` only notifies the position channel if
  the player moved more than 0.05 units (epsilon skip)
- `EagleCompass` updates its arrow and label via direct DOM writes in a
  `requestAnimationFrame` loop; React never re-renders it during play
- `useGameState` uses an integer tick counter so `setState` skips
  when no semantic change has happened
- `Renderer`: DPR cap 1.0, no MSAA, no shadows, no preserveDrawingBuffer,
  no alpha; explicit `failIfMajorPerformanceCaveat: false`
- `World.findInteractable` / `findEagle` / `Combat.checkEnemyContact`
  use squared distance comparisons and short-circuit on the first hit
- `Camera` caches `cos(yaw)` and `sin(yaw)` across frames and only
  recomputes them when the mouse moved
- `MovementSystem.fixedUpdate` only runs when not eagle-mounted
- Single source of stamina/regen prevents redundant `notify()`s
- World fog tightened to 60–220 (was 80–280), so the renderer culls
  more vertices
- Horse-mounted path uses object identity comparisons, not string
  keys
- `Object.freeze(Materials)` prevents runtime material mutation

### Code quality

- Lint passes (0 errors, 0 warnings)
- Typecheck passes
- 29 tests pass (was 4)
- Dead code removed: `STAMINA_DRAIN`, `STAMINA_REGEN`,
  `INTERACT_RANGE`, `EAGLE_MOUNT_RANGE`, `FLIGHT_HEIGHT_BASE`,
  unused `three` imports, `Combat.onRespawn`, `Eagle.isFlying`

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173/
npm run build      # production bundle in dist/
npm run typecheck  # 0 errors
npm run lint       # 0 errors, 0 warnings
npm test           # 16 tests, all green
```

`npm run dev` is the fastest way to play. Click "Begin the Journey",
then click anywhere to acquire pointer lock.

## Controls

| Key | Action |
|---|---|
| `WASD` | Walk / ride / fly |
| `Shift` (hold) | Run / gallop / descend |
| `Mouse` | Look around |
| `Click` | Attack (sword swing or bow shot) |
| `T` | Toggle sword ↔ bow |
| `E` | Talk to a nearby NPC / advance to default choice |
| `1` / `2` / `3` | Pick a dialogue choice by index |
| `Q` | Dismount / remount horse |
| `F` | Mount a nearby eagle |
| `Space` | Climb (eagle) |
| `Esc` | Back to menu / close dialogue |

## File map

```
ch993/
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
├── eslint.config.js                  # flat config (ESLint v10)
├── index.html
├── README.md
├── public/assets/                    # pre-built orc.bin + orc-atlas.jpg
├── assets-src/                       # source files for the build pipeline
├── scripts/build-orc.ts              # offline orc decimation pipeline
├── tests/
│   ├── combat.test.ts                # NEW: sword/bow stamina, weapon toggle, dialog gate
│   ├── dialogue-tree.test.ts         # NEW: branches actually walk
│   ├── enemy-ground.test.ts
│   ├── game-state.test.ts            # NEW: change-detection guards
│   ├── orc-asset.test.ts
│   ├── player-move.test.ts           # NEW: WASD direction math, world clamp
│   ├── respawn-mount.test.ts         # NEW: eagle-mount respawn
│   └── world-clamps.test.ts          # NEW: world bounds, day-night cycle
└── src/
    ├── main.tsx
    ├── App.tsx                       # menu / game state machine
    ├── styles/{theme,layout}.css
    ├── engine/
    │   ├── core/
    │   │   ├── Engine.ts             # main loop, fixed-step
    │   │   ├── Input.ts              # keyboard / mouse / pointer lock
    │   │   ├── Audio.ts              # Web Audio synthesis
    │   │   ├── GameState.ts          # observable HUD state, change-detection
    │   │   └── Pools.ts              # object pool
    │   ├── render/
    │   │   ├── Renderer.ts           # WebGLRenderer + DPR cap + no-GPU hints
    │   │   ├── Materials.ts          # shared MeshLambertMaterials
    │   │   ├── Geometries.ts         # shared Box / Sphere / Cylinder
    │   │   └── OrcModel.ts           # instanced uruk-hai, vertex-shader foot swing
    │   ├── world/
    │   │   └── World.ts              # terrain, trees, rocks, flowers, NPCs, enemies
    │   ├── entities/
    │   │   ├── Player.ts
    │   │   ├── Horse.ts
    │   │   ├── Eagle.ts
    │   │   ├── NPC.ts
    │   │   └── Enemy.ts
    │   └── systems/
    │       ├── Camera.ts             # third-person follow + mouse-look
    │       ├── MovementSystem.ts     # WASD + run stamina (drain only)
    │       ├── MountSystem.ts        # horse + eagle riding (with forceDismount)
    │       ├── Combat.ts             # sword melee + bow ranged + damage intake
    │       ├── Arrow.ts              # pooled projectile
    │       └── Dialogue.ts           # tree walker with E / 1 / 2 / 3
    └── ui/
        ├── GameView.tsx              # canvas + engine mount
        ├── HUD.tsx                   # health / stamina / weapon / mount / quests
        ├── DialogueBox.tsx           # speaker + line + choices
        ├── EagleCompass.tsx          # direct-DOM updated compass
        ├── MainMenu.tsx              # title + credits
        └── useGameState.ts           # split fast / slow subscription hooks
```

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | ✓ 0 errors |
| `npm run lint` | ✓ 0 errors, 0 warnings |
| `npm run build` | ✓ 3.06s, 4 chunks |
| `npm test` | ✓ 29 pass, 0 fail (36,110 assertions) |
| `npm run dev` (live) | ✓ serves on `http://127.0.0.1:5173/` |

## What's still in scope for future iterations

1. **Multi-region map.** Right now everything is in the Shire area.
   Add Rivendell, Moria, Mordor as separate sub-scenes with their own
   terrain seeds and NPC rosters.
2. **Save/load.** `localStorage` snapshot of position, health, quests,
   discovered eagle. The `Storage.ts` module is the seam.
3. **Day/night cycle** — now implemented (`World.dayPhase`,
   `applyDayNightLighting`). 4-minute cycle: sun position, intensity,
   ambient, and fog colour all track the phase. See World.ts:184.

4. **Better dialogue branching.** The tree is now walked but still has
   only a few branches per node; add a real choice selector with arrow
   keys and free-text input for named NPCs.
5. **Sound design depth.** Right now each cue is one oscillator.
   Layered synthesis (multiple oscillators, envelopes, spatial
   positioning) would lift the audio from "functional" to "epic".
6. **Enemy variety.** Orcs → wargs (mounted, faster, lower HP), uruk-hai
   (heavier, slower, more damage), fell beasts (flying).
7. **Mounted combat.** Right click while riding to swing the sword
   in the horse's gait direction.