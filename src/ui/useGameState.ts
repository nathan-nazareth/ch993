// useGameState.ts — React hook that subscribes to GameState.

import { useEffect, useState } from "react";
import type { GameState } from "@/engine/core/GameState";

export function useGameState(state: GameState) {
  const [, setTick] = useState(0);
  useEffect(() => {
    return state.subscribe(() => setTick((t) => t + 1));
  }, [state]);
  return state;
}
