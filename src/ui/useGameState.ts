// useGameState.ts — React hooks that subscribe to GameState.
//
// `useGameState` listens to the slow channel (HP, stamina, weapon,
// mount, dialogue, quests, hints). The HUD re-renders only when one
// of those actually changes.
//
// `usePositionRef` opens the fast channel (player XYZ, eagle XYZ) and
// returns a ref that is overwritten on every engine tick. Components
// that need to draw a moving arrow (EagleCompass) read the ref in a
// manual rAF loop and mutate the DOM directly — no React reconciliation.

import { useEffect, useRef, useState } from "react";
import type { GameState, PositionInfo } from "@/engine/core/GameState";

export function useGameState(state: GameState): GameState {
  const [, setTick] = useState(0);
  useEffect(() => state.subscribe(() => setTick((t) => (t + 1) | 0)), [state]);
  return state;
}

export function usePositionRef(state: GameState): React.MutableRefObject<PositionInfo> {
  const ref = useRef<PositionInfo>(state.playerPosition);
  useEffect(() => state.subscribePosition(() => {
    ref.current = state.playerPosition;
  }), [state]);
  return ref;
}