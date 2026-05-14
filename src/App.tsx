import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import GameCanvas from "./components/GameCanvas";
import { DEFAULT_SETTINGS, type AppSettings } from "./settings";
import battleTrackA from "./assets/Nervous Footsteps.mp3";
import battleTrackB from "./assets/Submerged Split.mp3";
import battleTrackC from "./assets/Tilted Piano Room.mp3";
import mainThemeTrack from "./assets/mainthema.mp3";
import "./app.css";

const MENU_ITEMS = [
  { id: "casual", label: "CASUAL" },
  { id: "double", label: "DOUBLE" },
  { id: "practice", label: "PRACTICE" },
  { id: "settings", label: "SETTINGS" },
] as const;

type MenuMode = "casual" | "practice" | "double";
type QueueMode = "casual" | "ranked";
type ViewState = "menu" | "settings" | "matchmaking";
type ControlKey = keyof AppSettings["controls"];

const SETTINGS_STORAGE_KEY = "rainbow-chain-settings";
const GUEST_NICKNAME_STORAGE_KEY = "guestNickname";
const BATTLE_TRACKS = [battleTrackA, battleTrackB, battleTrackC];
const MATCHMAKING_DURATION_SECONDS = 20;
const TRANSITION_FADE_MS = 320;
const TRANSITION_HOLD_MS = 200;
const TRANSITION_SWAP_MS = TRANSITION_FADE_MS;
const TRANSITION_TOTAL_MS = TRANSITION_FADE_MS * 2 + TRANSITION_HOLD_MS;

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

function sanitizeNickname(value: string): string {
  return value.trim().slice(0, 8);
}

function generateGuestNickname(): string {
  return `Guest_${Math.floor(10 + Math.random() * 90)}`;
}

function readStoredGuestNickname(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(GUEST_NICKNAME_STORAGE_KEY);
  return raw ? sanitizeNickname(raw) : "";
}

function saveGuestNickname(value: string): string {
  const nextNickname = sanitizeNickname(value) || generateGuestNickname();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GUEST_NICKNAME_STORAGE_KEY, nextNickname);
  }
  return nextNickname;
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

function LoadingTransitionOverlay({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  const dust = useMemo(
    () => createMenuDust(22).map((particle) => ({
      ...particle,
      size: Math.max(2, particle.size - 1.5),
      opacity: Math.min(0.22, particle.opacity * 0.55),
      duration: particle.duration * 0.7,
    })),
    [],
  );

  return (
    <div className={`screen-loading-transition ${active ? "is-active" : ""}`} aria-hidden="true">
      <div className="screen-loading-transition__veil" />
      {dust.map((particle) => (
        <span
          key={particle.id}
          className="screen-loading-transition__dust"
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
      <div className="screen-loading-transition__label">
        <span>{label}</span>
        <span className="screen-loading-transition__dots" aria-hidden="true" />
      </div>
    </div>
  );
}

function formatQueueTime(totalSeconds: number): string {
  return `00:${String(Math.min(MATCHMAKING_DURATION_SECONDS, totalSeconds)).padStart(2, "0")}`;
}

function GuestNicknameModal({
  value,
  onChange,
  onConfirm,
}: {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="guest-modal-backdrop">
      <form
        className="guest-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <p className="guest-modal__title">Please write your nickname.</p>
        <input
          autoFocus
          maxLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value.slice(0, 8))}
          className="guest-modal__input"
          type="text"
          spellCheck={false}
        />
        <button type="submit" className="guest-modal__button">
          start
        </button>
      </form>
    </div>
  );
}

function MainMenu({
  language,
  nickname,
  particleCount,
  onOpenSettings,
  onQueueStart,
  onStartGame,
}: {
  language: AppSettings["language"];
  nickname: string;
  particleCount: number;
  onOpenSettings: () => void;
  onQueueStart: (mode: QueueMode) => void;
  onStartGame: (mode: MenuMode) => void;
}) {
  const title = language === "ko" ? "레인보우-체인" : "Rainbow-chain";

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
                  if (item.id === "casual") {
                    onQueueStart(item.id);
                    return;
                  }
                  onStartGame(item.id);
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

function MatchmakingView({
  nickname,
  particleCount,
  elapsedSeconds,
  queueMode,
  aiDeployed,
  onCancel,
}: {
  nickname: string;
  particleCount: number;
  elapsedSeconds: number;
  queueMode: QueueMode;
  aiDeployed: boolean;
  onCancel: () => void;
}) {
  return (
    <main className="menu-shell">
      <section className="menu-frame matchmaking-frame" aria-label="Matchmaking">
        <MenuBackground particleCount={particleCount} />

        <header className="matchmaking-header">
          <h1 className="menu-title">Rainbow-chain</h1>
          <div className="matchmaking-timer-wrap">
            <div className="matchmaking-timer">{formatQueueTime(elapsedSeconds)}</div>
          </div>
          <div className="menu-nickname">{nickname}</div>
        </header>

        <section className="matchmaking-body">
          <div className="matchmaking-card">
            <div className="matchmaking-label">{queueMode === "ranked" ? "RANKED MATCHMAKING" : "CASUAL MATCHMAKING"}</div>
            <div className={`matchmaking-status ${aiDeployed ? "is-ready" : ""}`}>
              {aiDeployed ? "AI MATCH" : "MATCHMAKING"}
            </div>
            <div className="matchmaking-detail">
              {aiDeployed ? "AI opponent deployed" : "Searching for opponent..."}
            </div>
            {!aiDeployed ? (
              <button type="button" className="matchmaking-cancel" onClick={onCancel}>
                cancel
              </button>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function SettingsView({
  settings,
  nickname,
  listeningKey,
  particleCount,
  onBack,
  onChange,
  onChangeNickname,
  onStartListening,
}: {
  settings: AppSettings;
  nickname: string;
  listeningKey: ControlKey | null;
  particleCount: number;
  onBack: () => void;
  onChange: (next: AppSettings) => void;
  onChangeNickname: (value: string) => void;
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
            <h2 className="settings-heading">Nickname</h2>
            <label className="settings-input-row">
              <span className="settings-label">Guest Name</span>
              <input
                type="text"
                maxLength={8}
                value={nickname}
                className="settings-text-input"
                onChange={(event) => onChangeNickname(event.target.value)}
                spellCheck={false}
              />
            </label>
          </section>

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
  const storedGuestNickname = readStoredGuestNickname();
  const [selectedMode, setSelectedMode] = useState<MenuMode | null>(null);
  const [view, setView] = useState<ViewState>("menu");
  const [queueMode, setQueueMode] = useState<QueueMode>("casual");
  const [queueSeconds, setQueueSeconds] = useState(0);
  const [aiMatchDeployed, setAiMatchDeployed] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => readStoredSettings());
  const [listeningKey, setListeningKey] = useState<ControlKey | null>(null);
  const [guestNickname, setGuestNickname] = useState(storedGuestNickname);
  const [nicknameInput, setNicknameInput] = useState(storedGuestNickname);
  const [hasEnteredNickname, setHasEnteredNickname] = useState(storedGuestNickname.length > 0);
  const [transitionActive, setTransitionActive] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("LOADING");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioKindRef = useRef<"menu" | "battle" | null>(null);
  const audioTrackRef = useRef<string | null>(null);
  const retryAudioRef = useRef<(() => void) | null>(null);
  const audioResumeRef = useRef<(() => void) | null>(null);
  const transitionTimersRef = useRef<number[]>([]);
  const transitionBusyRef = useRef(false);

  useEffect(() => {
    return () => {
      for (const timerId of transitionTimersRef.current) window.clearTimeout(timerId);
      transitionTimersRef.current = [];
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
        audioTrackRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const resumeAudio = () => {
      audioResumeRef.current?.();
    };

    window.addEventListener("pointerdown", resumeAudio, true);
    window.addEventListener("keydown", resumeAudio, true);
    return () => {
      window.removeEventListener("pointerdown", resumeAudio, true);
      window.removeEventListener("keydown", resumeAudio, true);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (view !== "matchmaking") return;
    setQueueSeconds(0);
    setAiMatchDeployed(false);

    const startedAt = Date.now();
    let deployTimeoutId = 0;
    const timerId = window.setInterval(() => {
      const elapsed = Math.min(
        MATCHMAKING_DURATION_SECONDS,
        Math.floor((Date.now() - startedAt) / 1000),
      );
      setQueueSeconds(elapsed);
      if (elapsed >= MATCHMAKING_DURATION_SECONDS) {
        window.clearInterval(timerId);
        setAiMatchDeployed(true);
        deployTimeoutId = window.setTimeout(() => {
          runScreenTransition("DEPLOYING AI OPPONENT", () => {
            setView("menu");
            setSelectedMode("casual");
          });
        }, 1100);
      }
    }, 200);

    return () => {
      window.clearInterval(timerId);
      window.clearTimeout(deployTimeoutId);
    };
  }, [view, queueMode]);

  const confirmGuestNickname = () => {
    const nextNickname = saveGuestNickname(nicknameInput);
    setGuestNickname(nextNickname);
    setNicknameInput(nextNickname);
    setHasEnteredNickname(true);
  };

  const updateGuestNickname = (value: string) => {
    const nextInput = value.slice(0, 8);
    setGuestNickname(nextInput);
    setNicknameInput(nextInput);
    const nextNickname = saveGuestNickname(nextInput);
    setGuestNickname(nextNickname);
    setNicknameInput(nextNickname);
    setHasEnteredNickname(true);
  };

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

    audioResumeRef.current = playRequestedAudio;

    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    if (audioKindRef.current !== kind || (kind === "menu" && audioTrackRef.current !== mainThemeTrack)) {
      playRequestedAudio();
    } else if (audioRef.current && audioRef.current.paused) {
      playRequestedAudio();
    }

    return () => {
      cleanupRetry();
      if (audioResumeRef.current === playRequestedAudio) {
        audioResumeRef.current = null;
      }
    };
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

  const clearTransitionTimers = () => {
    for (const timerId of transitionTimersRef.current) window.clearTimeout(timerId);
    transitionTimersRef.current = [];
    transitionBusyRef.current = false;
  };

  const runScreenTransition = (label: string, applyChange: () => void) => {
    if (transitionBusyRef.current) return;
    transitionBusyRef.current = true;
    setTransitionLabel(label);
    setTransitionActive(true);
    clearTransitionTimers();
    transitionBusyRef.current = true;

    transitionTimersRef.current.push(window.setTimeout(() => {
      applyChange();
    }, TRANSITION_SWAP_MS));

    transitionTimersRef.current.push(window.setTimeout(() => {
      setTransitionActive(false);
      transitionBusyRef.current = false;
      transitionTimersRef.current = [];
    }, TRANSITION_TOTAL_MS));
  };

  let content = null;
  if (selectedMode !== null) {
    content = (
      <GameCanvas
        mode={selectedMode}
        settings={settings}
        onExit={() => {
          runScreenTransition("LOADING", () => {
            setSelectedMode(null);
            setView("menu");
          });
        }}
      />
    );
  } else if (view === "settings") {
    content = (
      <SettingsView
        settings={settings}
        nickname={guestNickname}
        listeningKey={listeningKey}
        particleCount={particleCount}
        onBack={() => {
          setListeningKey(null);
          runScreenTransition("LOADING", () => setView("menu"));
        }}
        onChange={setSettings}
        onChangeNickname={updateGuestNickname}
        onStartListening={setListeningKey}
      />
    );
  } else if (view === "matchmaking") {
    content = (
      <MatchmakingView
        nickname={guestNickname || generateGuestNickname()}
        particleCount={particleCount}
        elapsedSeconds={queueSeconds}
        queueMode={queueMode}
        aiDeployed={aiMatchDeployed}
        onCancel={() => {
          runScreenTransition("LOADING", () => {
            setQueueSeconds(0);
            setAiMatchDeployed(false);
            setView("menu");
          });
        }}
      />
    );
  } else {
    content = (
      <MainMenu
        language={settings.language}
        nickname={guestNickname || "Guest_00"}
        particleCount={particleCount}
        onOpenSettings={() => runScreenTransition("LOADING", () => setView("settings"))}
        onQueueStart={(mode) => {
          runScreenTransition("MATCHMAKING", () => {
            setQueueMode(mode);
            setView("matchmaking");
          });
        }}
        onStartGame={(mode) => runScreenTransition("LOADING", () => setSelectedMode(mode))}
      />
    );
  }

  return (
    <div style={shellStyle}>
      {content}
      {!hasEnteredNickname ? (
        <GuestNicknameModal
          value={nicknameInput}
          onChange={setNicknameInput}
          onConfirm={confirmGuestNickname}
        />
      ) : null}
      <LoadingTransitionOverlay active={transitionActive} label={transitionLabel} />
    </div>
  );
}
