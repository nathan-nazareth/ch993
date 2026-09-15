// EagleCompass.ts — a small banner at the top of the screen that
// points to the eagle's perch until the player has discovered it.
//
// Performance: the angle/distance update is a direct DOM write inside
// a requestAnimationFrame loop driven by the position-only channel.
// React never re-renders for player movement. The container renders
// exactly once when the banner appears or disappears.

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/engine/core/GameState";
import { usePositionRef } from "./useGameState";

export function EagleCompass({ state }: { state: GameState }) {
  const playerRef = usePositionRef(state);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(() => state.eaglePosition != null && !state.discoveredEagle);

  // React only renders when visibility flips, not on every frame.
  useEffect(() => {
    const check = () => {
      const eagle = state.eaglePosition;
      const shouldShow = !!eagle && !state.discoveredEagle;
      setVisible((prev) => (prev === shouldShow ? prev : shouldShow));
    };
    const id = window.setInterval(check, 250);
    return () => window.clearInterval(id);
  }, [state]);

  // Direct-DOM update loop: read positions from refs, write to
  // innerText / transform. No setState, no React scheduler.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const tick = () => {
      const eagle = state.eaglePosition;
      const player = playerRef.current;
      if (eagle) {
        const dx = eagle.x - player.x;
        const dz = eagle.z - player.z;
        const dist = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, -dz) * (180 / Math.PI);
        if (arrowRef.current) arrowRef.current.style.transform = `rotate(${angle}deg)`;
        if (labelRef.current) labelRef.current.textContent = `Eagle · ${Math.round(dist)}m · press F to mount`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, state, playerRef]);

  if (!visible) return null;

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
        ref={arrowRef}
        style={{
          display: "inline-block",
          fontSize: "1.2rem",
          transformOrigin: "center",
          transition: "transform 0.15s linear",
        }}
      >
        ▲
      </span>
      <span ref={labelRef}>Eagle · —m · press F to mount</span>
    </div>
  );
}