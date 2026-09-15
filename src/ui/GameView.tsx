// GameView.tsx — wires the React HUD to the engine instance.

import { useEffect, useRef, useState } from "react";
import { Engine } from "@/engine/core/Engine";
import { loadOrcAssets } from "@/engine/render/OrcModel";
import { HUD } from "./HUD";
import { DialogueBox } from "./DialogueBox";
import { EagleCompass } from "./EagleCompass";

export function GameView({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: Engine | null = null;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // The uruk-hai model loads before the engine spins up (it falls
    // back to plain boxes if unavailable, so the game always starts).
    void (async () => {
      const orcAssets = await loadOrcAssets();
      if (cancelled) return;
      engine = new Engine(canvas, orcAssets);
      setEngine(engine);
      engine.audio.init();
      engine.audio.startAmbientWind();
      engine.start();

      timers.push(setTimeout(() => {
        engine?.state.pushHint("WASD walk · Click attack · T swap sword/bow · Shift run", 6000);
      }, 800));
      timers.push(setTimeout(() => {
        engine?.state.pushHint("Follow the gold arrow — the great eagle circles overhead. Walk within reach and press F.", 7000);
      }, 6500));
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !engine?.state.activeDialogue) {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      engine?.stop();
      setEngine(null);
    };
  }, [onExit]);

  return (
    <div className="game-container">
      <canvas ref={canvasRef} className="game-canvas" tabIndex={0} />
      {engine && <HUD state={engine.state} />}
      {engine && <EagleCompass state={engine.state} />}
      {engine && <DialogueBox state={engine.state} />}
    </div>
  );
}
