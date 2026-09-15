// App.tsx — top-level state machine: menu, game, credits.

import { useState } from "react";
import { MainMenu } from "./ui/MainMenu";
import { GameView } from "./ui/GameView";

type Screen = "menu" | "game" | "credits";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");

  if (screen === "game") {
    return <GameView onExit={() => setScreen("menu")} />;
  }
  return (
    <MainMenu
      onStart={() => setScreen("game")}
      onCredits={() => setScreen("credits")}
    />
  );
}
