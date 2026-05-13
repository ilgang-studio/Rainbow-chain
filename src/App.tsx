import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import GameCanvas from "./components/GameCanvas";
import { DEFAULT_SETTINGS, type AppSettings } from "./settings";
import battleTrackA from "./assets/Nervous Footsteps.wav";
import battleTrackB from "./assets/Submerged Split.wav";
import battleTrackC from "./assets/Tilted Piano Room.wav";
import mainThemeTrack from "./assets/mainthema.wav";
import "./app.css";

const MENU_ITEMS = [
  { id: "casual", label: "CASUAL" },
  { id: "double", label: "DOUBLE" },
  { id: "practice", label: "PRACTICE" },
  { id: "settings", label: "SETTINGS" },
] as const;

type MenuMode = "casual" | "practice" | "double";
type ViewState = "menu" | "settings";
type ControlKey = keyof AppSettings["controls"];

const SETTINGS_STORAGE_KEY = "rainbow-chain-settings";
const BATTLE_TRACKS = [battleTrackA, battleTrackB, battleTrackC];

function createMenuDust(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: `${Math.random() * 100}%`,
    size: 2 + Math.random() * 5,
    duration: 10 + Math.random() * 12,
    delay: Math.random() * 10,
    drift: -22 + Math.random() * 44,
    opacity: 0.18 + Math.random() * 0.28,
  }));
}

function readStoredSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      controls: {
        ...DEFAULT_SETTINGS.controls,
        ...parsed.controls,
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function formatKeyLabel(key: string): string {
  if (key === " ") return "SPACE";
  return key.length === 1 ? key.toUpperCase() : key.toUpperCase().replace("ARROW", "");
}

function MenuBackground({ particleCount }: { particleCount: number }) {
  const dust = useMemo(() => createMenuDust(particleCount), [particleCount]);

  return (
    <div className="menu-background-fx" aria-hidden="true">
      {dust.map((particle) => (
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
  );
}

function MainMenu({
  language,
  particleCount,
  onOpenSettings,
  onStart,
}: {
  language: AppSettings["language"];
  particleCount: number;
  onOpenSettings: () => void;
  onStart: (mode: MenuMode) => void;
}) {
  const title = language === "ko" ? "레인보우-체인" : "Rainbow-chain";
  const nickname = language === "ko" ? "닉네임" : "Nickname";

  return (
    <main className="menu-shell">
      <section className="menu-frame" aria-label="Main menu">
        <MenuBackground particleCount={particleCount} />

        <header className="menu-header">
          <h1 className="menu-title">{title}</h1>
          <div className="menu-nickname">{nickname}</div>
        </header>

        <section className="menu-buttons" aria-label="Modes">
          <div className="menu-stack">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="menu-button"
                onClick={() => {
                  if (item.id === "settings") {
                    onOpenSettings();
                    return;
                  }
                  onStart(item.id);
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

function SettingsView({
  settings,
  listeningKey,
  particleCount,
  onBack,
  onChange,
  onStartListening,
}: {
  settings: AppSettings;
  listeningKey: ControlKey | null;
  particleCount: number;
  onBack: () => void;
  onChange: (next: AppSettings) => void;
  onStartListening: (key: ControlKey) => void;
}) {
  return (
    <main className="menu-shell">
      <section className="menu-frame settings-frame" aria-label="Settings">
        <MenuBackground particleCount={particleCount} />

        <header className="menu-header">
          <h1 className="menu-title">Settings</h1>
          <button type="button" className="settings-back" onClick={onBack}>
            back
          </button>
        </header>

        <section className="settings-grid">
          <section className="settings-card">
            <h2 className="settings-heading">Language</h2>
            <div className="settings-segment">
              {(["en", "ko"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  className={`settings-pill ${settings.language === language ? "is-active" : ""}`}
                  onClick={() => onChange({ ...settings, language })}
                >
                  {language === "en" ? "English" : "Korean"}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card settings-card--wide">
            <h2 className="settings-heading">Key Settings</h2>
            <div className="settings-key-grid">
              {(Object.entries(settings.controls) as [ControlKey, string][]).map(([key, value]) => (
                <div key={key} className="settings-key-row">
                  <span className="settings-label">{key}</span>
                  <button
                    type="button"
                    className={`settings-key-button ${listeningKey === key ? "is-listening" : ""}`}
                    onClick={() => onStartListening(key)}
                  >
                    {listeningKey === key ? "press key..." : formatKeyLabel(value)}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-heading">Sound</h2>
            <label className="settings-slider-row">
              <span className="settings-label">BGM</span>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.bgmVolume}
                onChange={(e) => onChange({ ...settings, bgmVolume: Number(e.target.value) })}
              />
            </label>
            <label className="settings-slider-row">
              <span className="settings-label">SFX</span>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.sfxVolume}
                onChange={(e) => onChange({ ...settings, sfxVolume: Number(e.target.value) })}
              />
            </label>
          </section>

          <section className="settings-card">
            <h2 className="settings-heading">Glow / Particle</h2>
            <div className="settings-group">
              <span className="settings-label">Glow</span>
              <div className="settings-segment">
                {(["low", "medium", "high"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`settings-pill ${settings.glowIntensity === value ? "is-active" : ""}`}
                    onClick={() => onChange({ ...settings, glowIntensity: value })}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-group">
              <span className="settings-label">Particle</span>
              <div className="settings-segment">
                {(["low", "medium", "high"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`settings-pill ${settings.particleIntensity === value ? "is-active" : ""}`}
                    onClick={() => onChange({ ...settings, particleIntensity: value })}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

export default function App() {
  const [selectedMode, setSelectedMode] = useState<MenuMode | null>(null);
  const [view, setView] = useState<ViewState>("menu");
  const [settings, setSettings] = useState<AppSettings>(() => readStoredSettings());
  const [listeningKey, setListeningKey] = useState<ControlKey | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioKindRef = useRef<"menu" | "battle" | null>(null);
  const audioTrackRef = useRef<string | null>(null);
  const retryAudioRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
        audioTrackRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (listeningKey === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      setSettings((prev) => ({
        ...prev,
        controls: {
          ...prev.controls,
          [listeningKey]: event.key,
        },
      }));
      setListeningKey(null);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [listeningKey]);

  useEffect(() => {
    const kind: "menu" | "battle" = selectedMode === null ? "menu" : "battle";
    const volume = Math.max(0, Math.min(1, settings.bgmVolume / 100));
    const cleanupRetry = () => {
      if (retryAudioRef.current) {
        window.removeEventListener("pointerdown", retryAudioRef.current);
        window.removeEventListener("keydown", retryAudioRef.current);
        retryAudioRef.current = null;
      }
    };

    const scheduleRetry = (playFn: () => void) => {
      cleanupRetry();
      retryAudioRef.current = () => {
        cleanupRetry();
        playFn();
      };
      window.addEventListener("pointerdown", retryAudioRef.current, { once: true });
      window.addEventListener("keydown", retryAudioRef.current, { once: true });
    };

    const startBattlePlaylist = (audio: HTMLAudioElement) => {
      audio.loop = false;
      audio.onended = () => {
        if (audioKindRef.current !== "battle") return;
        const nextTrack = BATTLE_TRACKS[Math.floor(Math.random() * BATTLE_TRACKS.length)];
        audioTrackRef.current = nextTrack;
        audio.src = nextTrack;
        void audio.play().catch(() => {
          scheduleRetry(() => {
            if (audioKindRef.current === "battle") {
              void audio.play().catch(() => {});
            }
          });
        });
      };
    };

    const playRequestedAudio = () => {
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audioRef.current = audio;
      }

      audio.volume = volume;
      audioKindRef.current = kind;

      if (kind === "menu") {
        audio.onended = null;
        audio.loop = true;
        if (audioTrackRef.current !== mainThemeTrack) {
          audioTrackRef.current = mainThemeTrack;
          audio.src = mainThemeTrack;
        }
      } else {
        if (!audioTrackRef.current || !BATTLE_TRACKS.includes(audioTrackRef.current)) {
          const battleTrack = BATTLE_TRACKS[Math.floor(Math.random() * BATTLE_TRACKS.length)];
          audioTrackRef.current = battleTrack;
          audio.src = battleTrack;
        }
        startBattlePlaylist(audio);
      }

      void audio.play().catch(() => {
        scheduleRetry(playRequestedAudio);
      });
    };

    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    if (audioKindRef.current !== kind || (kind === "menu" && audioTrackRef.current !== mainThemeTrack)) {
      playRequestedAudio();
    } else if (audioRef.current && audioRef.current.paused) {
      playRequestedAudio();
    }

    return cleanupRetry;
  }, [selectedMode, settings.bgmVolume]);

  const particleCount = settings.particleIntensity === "low"
    ? 40
    : settings.particleIntensity === "high"
      ? 70
      : 56;

  const shellStyle = {
    "--menu-glow-strength":
      settings.glowIntensity === "low"
        ? "0.65"
        : settings.glowIntensity === "high"
          ? "1.35"
          : "1",
  } as CSSProperties;

  if (selectedMode !== null) {
    return (
      <GameCanvas
        mode={selectedMode}
        settings={settings}
        onExit={() => setSelectedMode(null)}
      />
    );
  }

  if (view === "settings") {
    return (
      <div style={shellStyle}>
        <SettingsView
          settings={settings}
          listeningKey={listeningKey}
          particleCount={particleCount}
          onBack={() => {
            setListeningKey(null);
            setView("menu");
          }}
          onChange={setSettings}
          onStartListening={setListeningKey}
        />
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <MainMenu
        language={settings.language}
        particleCount={particleCount}
        onOpenSettings={() => setView("settings")}
        onStart={setSelectedMode}
      />
    </div>
  );
}
