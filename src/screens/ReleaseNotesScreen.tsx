import { APP_NAME, APP_VERSION } from "../version";

type ReleaseNotesScreenProps = {
  onBack: () => void;
};

export default function ReleaseNotesScreen({ onBack }: ReleaseNotesScreenProps) {
  return (
    <div className="screen center">
      <h1>{APP_NAME} – Release notes</h1>
      <p>Version actuelle : {APP_VERSION}</p>

      <section style={{ maxWidth: 700, textAlign: "left", marginTop: "2rem" }}>
        <h2>v0.1.0 – Initial public splash</h2>
        <ul>
          <li>Création du projet React + Vite</li>
          <li>Écran de splash PACMAN RETRO</li>
          <li>Déploiement GitHub Pages</li>
        </ul>

        {/* Plus tard tu ajouteras ici v0.2.0, v0.3.0, etc. */}
      </section>

      <button onClick={onBack} style={{ marginTop: "2rem" }}>
        Retour au menu
      </button>
    </div>
  );
}
