// MainMenu.tsx — title screen with a New Game button and credits.

import { useState } from "react";

export function MainMenu({ onStart, onCredits: _onCredits }: { onStart: () => void; onCredits: () => void }) {
  const [showCredits, setShowCredits] = useState(false);
  if (showCredits) {
    return (
      <div className="menu">
        <h1 className="menu__title" style={{ fontSize: "2.5rem" }}>Credits</h1>
        <div style={{ maxWidth: 540, color: "var(--shire-parchment)", lineHeight: 1.7, fontStyle: "italic" }}>
          <p>Inspired by J.R.R. Tolkien's Lord of the Rings.</p>
          <p>Built with Three.js, React, and the Web Audio API.</p>
          <p>All sound effects synthesised at runtime — no audio files.</p>
          <p>All geometry procedurally generated — no 3D model files.</p>
          <p>CPU-first; designed to run on devices with software rendering.</p>
        </div>
        <button className="menu__button" onClick={() => setShowCredits(false)}>
          Back
        </button>
      </div>
    );
  }
  return (
    <div className="menu">
      <h1 className="menu__title">Fellowship of the Ring</h1>
      <p className="menu__subtitle">A 3D adventure in Middle-earth</p>
      <button className="menu__button" onClick={onStart} autoFocus>
        Begin the Journey
      </button>
      <button className="menu__button" onClick={() => setShowCredits(true)}>
        Credits
      </button>
      <div
        style={{
          marginTop: "2rem",
          color: "var(--shire-parchment-dim)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.7rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Click to begin · WASD to move · Mouse to look · T to swap weapon
        <br />E to talk · Q to dismount · F to mount an eagle
      </div>
    </div>
  );
}
