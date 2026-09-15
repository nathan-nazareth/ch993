// DialogueBox.tsx — bottom-center dialogue card.

import type { GameState } from "@/engine/core/GameState";
import { useGameState } from "./useGameState";

export function DialogueBox({ state }: { state: GameState }) {
  const s = useGameState(state);
  if (!s.activeDialogue) return null;
  return (
    <div className="dialogue" role="dialog" aria-live="polite">
      <div className="dialogue__speaker">{s.activeDialogue.speaker}</div>
      <div className="dialogue__text">{s.activeDialogue.text}</div>
      <div className="dialogue__prompt">E to dismiss</div>
    </div>
  );
}
