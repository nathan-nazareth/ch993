// EagleCompass.ts — a small banner at the top of the screen that
// points to the eagle's perch until the player has discovered it.
// Subscribes to GameState so the angle updates as the player moves.

import type { GameState } from "@/engine/core/GameState";
import { useGameState } from "./useGameState";

export function EagleCompass({ state }: { state: GameState }) {
  const s = useGameState(state);
  if (!s.eaglePosition) return null;
  if (s.discoveredEagle) return null;

  const dx = s.eaglePosition.x - s.playerPosition.x;
  const dz = s.eaglePosition.z - s.playerPosition.z;
  const dist = Math.hypot(dx, dz);
  // Angle in screen space: 0 = up (north toward -Z).
  const angle = Math.atan2(dx, -dz) * (180 / Math.PI);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "5rem",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.5rem 1rem",
        background: "rgba(11, 10, 15, 0.85)",
        border: "1px solid var(--border-gold)",
        color: "var(--dwarven-gold)",
        fontFamily: "var(--font-display)",
        fontSize: "0.75rem",
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        pointerEvents: "none",
        backdropFilter: "blur(4px)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontSize: "1.2rem",
          transform: `rotate(${angle}deg)`,
          transformOrigin: "center",
          transition: "transform 0.15s linear",
        }}
      >
        ▲
      </span>
      <span>Eagle · {Math.round(dist)}m · press F to mount</span>
    </div>
  );
}
