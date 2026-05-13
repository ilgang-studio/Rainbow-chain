import { useState, type CSSProperties } from "react";
import GameCanvas from "./components/GameCanvas";
import "./app.css";

const MENU_ITEMS = [
  { id: "casual", label: "CASUAL" },
  { id: "practice", label: "PRACTICE" },
  { id: "settings", label: "SETTINGS" },
] as const;

type MenuMode = "casual" | "practice";

const MENU_DUST = Array.from({ length: 56 }, (_, index) => ({
  id: index,
  left: `${Math.random() * 100}%`,
  size: 2 + Math.random() * 5,
  duration: 10 + Math.random() * 12,
  delay: Math.random() * 10,
  drift: -22 + Math.random() * 44,
  opacity: 0.18 + Math.random() * 0.28,
}));

function MainMenu({ onStart }: { onStart: (mode: MenuMode) => void }) {
  return (
    <main className="menu-shell">
      <section className="menu-frame" aria-label="Main menu">
        <div className="menu-background-fx" aria-hidden="true">
          {MENU_DUST.map((particle) => (
            <span
              key={particle.id}
              className="menu-dust-particle"
              style={
                {
                  left: particle.left,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  animationDuration: `${particle.duration}s`,
                  animationDelay: `-${particle.delay}s`,
                  "--dust-drift": `${particle.drift}px`,
                  "--dust-opacity": String(particle.opacity),
                } as CSSProperties
              }
            />
          ))}
        </div>

        <header className="menu-header">
          <h1 className="menu-title">Rainbow-chain</h1>
          <div className="menu-nickname">Nickname</div>
        </header>

        <section className="menu-buttons" aria-label="Modes">
          <div className="menu-stack">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="menu-button"
                onClick={() => {
                  if (item.id === "casual" || item.id === "practice") {
                    onStart(item.id);
                  }
                }}
              >
                <span className="menu-button-label">{item.label.toLowerCase()}</span>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default function App() {
  const [selectedMode, setSelectedMode] = useState<MenuMode | null>(null);

  if (selectedMode !== null) {
    return <GameCanvas mode={selectedMode} />;
  }

  return <MainMenu onStart={setSelectedMode} />;
}
