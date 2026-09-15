// DialogueBox.tsx — bottom-center dialogue card.
//
// Shows the speaker, the current line, and the choices. Choices are
// selected with number keys (1/2/3); pressing E advances to the
// default (first) choice. Esc closes.

import type { GameState } from "@/engine/core/GameState";
import { useGameState } from "./useGameState";

export function DialogueBox({ state }: { state: GameState }) {
  const s = useGameState(state);
  if (!s.activeDialogue) return null;
  const hasChoices = s.activeDialogue.choices.length > 0;
  return (
    <div className="dialogue" role="dialog" aria-live="polite">
      <div className="dialogue__speaker">{s.activeDialogue.speaker}</div>
      <div className="dialogue__text">{s.activeDialogue.text}</div>
      {hasChoices && (
        <ul className="dialogue__choices" role="list">
          {s.activeDialogue.choices.map((c) => (
            <li key={c.index} className="dialogue__choice">
              <span className="dialogue__choice-key">{c.index + 1}</span>
              <span className="dialogue__choice-text">{c.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="dialogue__prompt">
        {hasChoices
          ? "1/2/3 to choose · E default · Esc close"
          : "E to dismiss"}
      </div>
    </div>
  );
}