// HUD.tsx — the in-game heads-up display. Health/stamina bars, weapon
// indicator, mount indicator, hint, location, quest log.

import type { GameState } from "@/engine/core/GameState";
import { useGameState } from "./useGameState";

export function HUD({ state }: { state: GameState }) {
  const s = useGameState(state);
  return (
    <div className="hud">
      <div className="crosshair" aria-hidden>
        <span className="crosshair__line crosshair__line--h" />
        <span className="crosshair__line crosshair__line--v" />
      </div>

      <DamageFlash time={s.damageFlashTime} />
      <HitMarker time={s.hitMarkerTime} />

      <StatBars state={s} />
      <WeaponIndicator state={s} />
      <MountIndicator state={s} />
      <QuestLog state={s} />
      <LocationLabel state={s} />
      <HintBubbles state={s} />
    </div>
  );
}

function DamageFlash({ time }: { time: number }) {
  if (time <= 0) return null;
  const opacity = Math.min(0.55, time * 1.6);
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse at center, transparent 40%, rgba(197, 48, 48, 0.8) 100%)",
        opacity,
        transition: "opacity 0.1s linear",
      }}
    />
  );
}

function HitMarker({ time }: { time: number }) {
  if (time <= 0) return null;
  const opacity = Math.min(1, time * 5);
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        opacity,
        fontSize: "1.2rem",
        color: "var(--dwarven-gold)",
        fontFamily: "var(--font-display)",
        letterSpacing: "0.2em",
        textShadow: "0 0 8px rgba(212, 165, 71, 0.6)",
      }}
    >
      ✦
    </div>
  );
}

function StatBars({ state }: { state: GameState }) {
  const healthPct = (state.health / state.maxHealth) * 100;
  const stamPct = (state.stamina / state.maxStamina) * 100;
  return (
    <div className="stat-bar">
      <div>
        <div className="stat-bar__label">Stamina</div>
        <div className="stat-bar__bar" aria-label={`Stamina ${Math.round(stamPct)}%`}>
          <div className="stat-bar__fill stat-bar__fill--stamina" style={{ width: `${stamPct}%` }} />
        </div>
      </div>
      <div>
        <div className="stat-bar__label">Health</div>
        <div className="stat-bar__bar" aria-label={`Health ${Math.round(healthPct)}%`}>
          <div className="stat-bar__fill stat-bar__fill--health" style={{ width: `${healthPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function WeaponIndicator({ state }: { state: GameState }) {
  return (
    <div className="weapon-indicator" aria-live="polite">
      <div className="weapon-indicator__label">Weapon (T)</div>
      {state.weapon === "sword" ? "Andúril" : "Bow of Lórien"}
    </div>
  );
}

function MountIndicator({ state }: { state: GameState }) {
  const labels: Record<typeof state.mount, string> = {
    horse: "Shadowfax · Q to dismount",
    eagle: "Great Eagle · Q to dismount",
    none: "On foot · Q remount horse · F mount eagle",
  };
  return (
    <div className="mount-indicator" aria-live="polite">
      <div className="mount-indicator__label">Mount</div>
      {labels[state.mount]}
    </div>
  );
}

function QuestLog({ state }: { state: GameState }) {
  return (
    <div className="quest-log">
      <div className="quest-log__title">Quest Log</div>
      {state.quests.map((q) => (
        <div
          key={q.id}
          className={`quest-log__entry quest-log__entry--${q.status}`}
        >
          {q.title}: {q.description}
        </div>
      ))}
      <div className="quest-log__entry" style={{ color: "var(--eye-red)", marginTop: "0.5rem" }}>
        Orcs slain: <strong>{state.kills}</strong>
      </div>
    </div>
  );
}

function LocationLabel({ state }: { state: GameState }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "2rem",
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "var(--font-display)",
        fontSize: "0.75rem",
        letterSpacing: "0.3em",
        color: "var(--shire-parchment-dim)",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      {state.currentLocation}
    </div>
  );
}

function HintBubbles({ state }: { state: GameState }) {
  if (state.recentHints.length === 0) return null;
  return (
    <>
      {state.recentHints.map((h, i) => (
        <div className="hint" key={i}>{h}</div>
      ))}
    </>
  );
}
