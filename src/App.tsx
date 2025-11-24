import { useState } from "react";
import SplashScreen from "./screens/SplashScreen";

type Screen = "splash" | "menu" | "game" | "gameOver" | "hallOfFame" | "credits";

function App() {
  const [screen, setScreen] = useState<Screen>("splash");

  const goToMenu = () => setScreen("menu");

  return (
    <div className="app-root">
      {screen === "splash" && <SplashScreen onContinue={goToMenu} />}

      {screen === "menu" && (
        <div className="screen center">
          <h1>Menu (placeholder)</h1>
          <p>On remplira ce composant juste après.</p>
        </div>
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
