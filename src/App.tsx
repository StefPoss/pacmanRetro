import { useState } from "react";
import SplashScreen from "./screens/SplashScreen";
import ReleaseNotesScreen from "./screens/ReleaseNotesScreen";

type Screen =
  | "splash"
  | "menu"
  | "game"
  | "gameOver"
  | "hallOfFame"
  | "credits"
  | "releaseNotes"; 

function App() {
  const [screen, setScreen] = useState<Screen>("splash");

  const goToMenu = () => setScreen("menu");

  return (
    <div className="app-root">
      {screen === "splash" && <SplashScreen onContinue={goToMenu} />}

      {screen === "menu" && (
        <div className="screen center">
          <h1>Menu (placeholder)</h1>
          <button onClick={() => setScreen("releaseNotes")}>
            Release notes
          </button>
        </div>
      )}

      {screen === "releaseNotes" && (
        <ReleaseNotesScreen onBack={() => setScreen("menu")} />
      )}

      {/* Les autres écrans viendront ensuite :
          - GameScreen
          - GameOverScreen
          - HallOfFameScreen
          - CreditsScreen
      */}
    </div>
  );
}

export default App;
