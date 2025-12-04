import { useEffect } from "react";
import { APP_NAME, APP_VERSION } from "../version";

type SplashScreenProps = {
  onContinue: () => void;
};

export default function SplashScreen({ onContinue }: SplashScreenProps) {
  useEffect(() => {
    const handleKeyDown = () => onContinue();
    const handleClick = () => onContinue();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick);
    };
  }, [onContinue]);

  return (
    <div className="screen splash">
      <div className="splash-inner">
        <h1 className="splash-title">{APP_NAME}</h1>
        <p className="splash-subtitle">Multi‑thèmes · Hall of Fame global · 8‑bit vibes</p>

        <p className="splash-action">
        APPUIE SUR UNE TOUCHE OU CLIQUE POUR CONTINUER
        </p>

        <p className="splash-version">{APP_VERSION}</p>

        <p className="splash-credits">
          vibe coded by{" "}
          <span className="splash-author">Lepacmaneur</span>
          {" "}&amp;{" "}
          <span className="splash-author">lepoSs</span>
        </p>
      </div>
    </div>
  );
}
