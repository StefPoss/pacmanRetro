import { useEffect } from "react";

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
        <h1 className="splash-title">PACMAN 2025</h1>
        <p className="splash-subtitle">Multi‑thèmes · Hall of Fame global · 8‑bit vibes</p>

        <p className="splash-action">
          Appuie sur une touche ou clique pour continuer
        </p>

        <p className="splash-credits">by COME POSSAMAI &amp; leposs</p>
      </div>
    </div>
  );
}
