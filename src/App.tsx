import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import GameCanvas from "./components/GameCanvas";
import type {
  ErrorPayload,
  MatchAiFallbackPayload,
  MatchFoundPayload,
  QueueJoinPayload,
  QueueTickPayload,

  RoomStartPayload,
} from "./network/events";
import { prepareSocketAuth, socket } from "./network/socket";
import type { AppSettings } from "./settings";
import { setLocale, t } from "./i18n";
import {
  useAppStore,
  type ControlKey,
  type MenuMode,
  type ViewState,
} from "./store/appStore";
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

type QueueMode = "casual";
const BATTLE_TRACKS = [battleTrackA, battleTrackB, battleTrackC];
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
  return `00:${String(Math.max(0, Math.min(99, totalSeconds))).padStart(2, "0")}`;
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
        <p className="guest-modal__title">{t("enterNickname")}</p>
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
          {t("start")}
        </button>
      </form>
    </div>
  );
}

function MainMenu({
  nickname,
  particleCount,
  onOpenSettings,
  onOpenHelp,
  onQueueStart,
  onStartGame,
}: {
  nickname: string;
  particleCount: number;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onQueueStart: (mode: QueueMode) => void;
  onStartGame: (mode: MenuMode) => void;
}) {
  return (
    <main className="menu-shell">
      <section className="menu-frame" aria-label="Main menu">
        <MenuBackground particleCount={particleCount} />

        <header className="menu-header">
          <h1 className="menu-title">Rainbow-chain</h1>
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
                <span className="menu-button-label">{t(item.id)}</span>
              </button>
            ))}
            <button
              type="button"
              className="menu-button"
              onClick={onOpenHelp}
            >
              <span className="menu-button-label">{t("help")}</span>
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function HelpView({
  particleCount,
  onBack,
}: {
  particleCount: number;
  onBack: () => void;
}) {
  const pages = [
    {
      title: t("helpPageBasics"),
      cards: [
        { heading: t("helpObjectiveTitle"), body: t("helpObjectiveBody") },
        { heading: t("helpControlsTitle"), body: t("helpControlsBody") },
        { heading: t("helpHazardsTitle"), body: t("helpHazardsBody") },
      ],
    },
    {
      title: t("helpPageChainsA"),
      cards: [
        { heading: t("helpChainNormalTitle"), body: t("helpChainNormalBody") },
        { heading: t("helpChainRushTitle"), body: t("helpChainRushBody") },
        { heading: t("helpChainTurnTitle"), body: t("helpChainTurnBody") },
        { heading: t("helpChainFakeTitle"), body: t("helpChainFakeBody") },
      ],
    },
    {
      title: t("helpPageChainsB"),
      cards: [
        { heading: t("helpChainGiantTitle"), body: t("helpChainGiantBody") },
        { heading: t("helpChainTrackingTitle"), body: t("helpChainTrackingBody") },
        { heading: t("helpChainPhaseTitle"), body: t("helpChainPhaseBody") },
      ],
    },
    {
      title: t("helpPageItemsModes"),
      cards: [
        { heading: t("helpItemsTitle"), body: t("helpItemsBody") },
        { heading: t("helpPracticeTitle"), body: t("helpPracticeBody") },
        { heading: t("helpModesTitle"), body: t("helpModesBody") },
      ],
    },
  ] as const;
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[pageIndex] ?? pages[0];
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === pages.length - 1;

  return (
    <main className="menu-shell">
      <section className="menu-frame settings-frame" aria-label="Help">
        <MenuBackground particleCount={particleCount} />

        <header className="menu-header">
          <h1 className="menu-title">{t("helpTitle")}</h1>
          <button type="button" className="settings-back" onClick={onBack}>
            {t("back")}
          </button>
        </header>

        <section className="help-book">
          <div className="help-book__meta">
            <span className="help-book__chapter">{page.title}</span>
            <span className="help-book__page">
              {pageIndex + 1} / {pages.length}
            </span>
          </div>

          <section className="settings-grid help-book__grid">
            {page.cards.map((card) => (
              <section key={card.heading} className="settings-card">
                <h2 className="settings-heading">{card.heading}</h2>
                <p className="help-copy">{card.body}</p>
              </section>
            ))}
          </section>

          <div className="help-book__nav">
            <button
              type="button"
              className="help-book__button"
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              disabled={isFirstPage}
            >
              {t("helpPrev")}
            </button>
            <button
              type="button"
              className="help-book__button"
              onClick={() => setPageIndex((current) => Math.min(pages.length - 1, current + 1))}
              disabled={isLastPage}
            >
              {t("helpNext")}
            </button>
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
  statusLabel,
  detailLabel,
  actionLabel,
  aiDeployed,
  onCancel,
}: {
  nickname: string;
  particleCount: number;
  elapsedSeconds: number;
  statusLabel: string;
  detailLabel: string;
  actionLabel: string;
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
            <div className="matchmaking-label">{t("casualMatchmaking")}</div>
            <div className={`matchmaking-status ${aiDeployed ? "is-ready" : ""}`}>
              {statusLabel}
            </div>
            <div className="matchmaking-detail">{detailLabel}</div>
            <button type="button" className="matchmaking-cancel" onClick={onCancel}>
              {actionLabel}
            </button>
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
          <h1 className="menu-title">{t("settingsTitle")}</h1>
          <button type="button" className="settings-back" onClick={onBack}>
            {t("back")}
          </button>
        </header>

        <section className="settings-grid">
          <section className="settings-card">
            <h2 className="settings-heading">{t("nicknameSetting")}</h2>
            <label className="settings-input-row">
              <span className="settings-label">{t("guestName")}</span>
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
            <h2 className="settings-heading">{t("languageSetting")}</h2>
            <div className="settings-segment">
              {(["en", "ko", "ja", "zh-CN"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={`settings-pill ${settings.language === lang ? "is-active" : ""}`}
                  onClick={() => onChange({ ...settings, language: lang })}
                >
                  {{ en: "English", ko: "한국어", ja: "日本語", "zh-CN": "中文" }[lang]}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card settings-card--wide">
            <h2 className="settings-heading">{t("keySettings")}</h2>
            <div className="settings-key-grid">
              {(Object.entries(settings.controls) as [ControlKey, string][]).map(([key, value]) => (
                <div key={key} className="settings-key-row">
                  <span className="settings-label">{key}</span>
                  <button
                    type="button"
                    className={`settings-key-button ${listeningKey === key ? "is-listening" : ""}`}
                    onClick={() => onStartListening(key)}
                  >
                    {listeningKey === key ? t("pressKey") : formatKeyLabel(value)}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-heading">{t("sound")}</h2>
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
            <h2 className="settings-heading">{t("glowParticle")}</h2>
            <div className="settings-group">
              <span className="settings-label">{t("glow")}</span>
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
              <span className="settings-label">{t("particle")}</span>
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
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  // 언어 변경 시 즉시 locale 동기화 (렌더 전에 실행되므로 t() 호출이 항상 현재 언어 반영)
  setLocale(settings.language);
  const selectedMode = useAppStore((state) => state.selectedMode);
  const setSelectedMode = useAppStore((state) => state.setSelectedMode);
  const view = useAppStore((state) => state.view);
  const setView = useAppStore((state) => state.setView);
  const queueSeconds = useAppStore((state) => state.queueSeconds);
  const setQueueSeconds = useAppStore((state) => state.setQueueSeconds);
  const aiMatchDeployed = useAppStore((state) => state.aiMatchDeployed);
  const setAiMatchDeployed = useAppStore((state) => state.setAiMatchDeployed);
  const matchmakingStatus = useAppStore((state) => state.matchmakingStatus);
  const setMatchmakingStatus = useAppStore((state) => state.setMatchmakingStatus);
  const matchmakingDetail = useAppStore((state) => state.matchmakingDetail);
  const setMatchmakingDetail = useAppStore((state) => state.setMatchmakingDetail);
  const activeRoomStart = useAppStore((state) => state.activeRoomStart);
  const setActiveRoomStart = useAppStore((state) => state.setActiveRoomStart);
  const listeningKey = useAppStore((state) => state.listeningKey);
  const setListeningKey = useAppStore((state) => state.setListeningKey);
  const guestId = useAppStore((state) => state.guestId);
  const guestNickname = useAppStore((state) => state.guestNickname);
  const nicknameInput = useAppStore((state) => state.nicknameInput);
  const setNicknameInput = useAppStore((state) => state.setNicknameInput);
  const hasEnteredNickname = useAppStore((state) => state.hasEnteredNickname);
  const transitionActive = useAppStore((state) => state.transitionActive);
  const setTransitionActive = useAppStore((state) => state.setTransitionActive);
  const transitionLabel = useAppStore((state) => state.transitionLabel);
  const setTransitionLabel = useAppStore((state) => state.setTransitionLabel);
  const battleTrackIndex = useAppStore((state) => state.battleTrackIndex);
  const setBattleTrackIndex = useAppStore((state) => state.setBattleTrackIndex);
  const ensureGuestIdentity = useAppStore((state) => state.ensureGuestIdentity);
  const updateGuestNickname = useAppStore((state) => state.updateGuestNickname);
  const confirmGuestNickname = useAppStore((state) => state.confirmGuestNickname);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioKindRef = useRef<"menu" | "battle" | null>(null);
  const audioTrackRef = useRef<string | null>(null);
  const retryAudioRef = useRef<(() => void) | null>(null);
  const audioResumeRef = useRef<(() => void) | null>(null);
  const viewRef = useRef<ViewState>(view);
  const selectedModeRef = useRef<MenuMode | null>(selectedMode);
  const pendingQueueJoinRef = useRef<QueueJoinPayload | null>(null);
  const roomReadyTimerRef = useRef<number | null>(null);
  const resetMatchmakingStateRef = useRef<() => void>(() => {});
  const runScreenTransitionRef = useRef<(label: string, applyChange: () => void) => void>(() => {});
  const transitionTimersRef = useRef<number[]>([]);
  const transitionBusyRef = useRef(false);

  useEffect(() => {
    return () => {
      if (roomReadyTimerRef.current !== null) {
        window.clearTimeout(roomReadyTimerRef.current);
      }
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
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    selectedModeRef.current = selectedMode;
  }, [selectedMode]);

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
        const battleTrack = BATTLE_TRACKS[((battleTrackIndex % BATTLE_TRACKS.length) + BATTLE_TRACKS.length) % BATTLE_TRACKS.length];
        if (audioTrackRef.current !== battleTrack) {
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
  }, [selectedMode, settings.bgmVolume, battleTrackIndex]);

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

  const clearRoomReadyTimer = () => {
    if (roomReadyTimerRef.current !== null) {
      window.clearTimeout(roomReadyTimerRef.current);
      roomReadyTimerRef.current = null;
    }
  };

  const resetMatchmakingState = () => {
    clearRoomReadyTimer();
    pendingQueueJoinRef.current = null;
    setQueueSeconds(0);
    setAiMatchDeployed(false);
    setMatchmakingStatus(t("matchmaking"));
    setMatchmakingDetail(t("searchingOpponent"));
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

  const emitQueueJoin = async (payload: QueueJoinPayload) => {
    pendingQueueJoinRef.current = payload;
    setMatchmakingDetail(t("connectingToServer"));

    if (socket.connected) {
      socket.emit("queue:join", payload);
      pendingQueueJoinRef.current = null;
      return;
    }

    try {
      await prepareSocketAuth(payload.guestId, payload.nickname);
      socket.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Socket authentication failed.";
      console.error("[socket:auth_error]", message);
      pendingQueueJoinRef.current = null;
      setMatchmakingStatus("QUEUE ERROR");
      setMatchmakingDetail(message);
    }
  };

  const beginMatchmaking = (mode: QueueMode) => {
    const identity = ensureGuestIdentity();
    resetMatchmakingState();

    const payload: QueueJoinPayload = {
      mode,
      nickname: identity.nickname,
      guestId: identity.guestId,
    };

    runScreenTransition(t("matchmaking"), () => {
      setView("matchmaking");
      void emitQueueJoin(payload);
    });
  };

  // 게임 중 → 새 큐로 이동 (리매치 timeout / opponent:left 시)
  const goToMatchmakingFromGame = () => {
    const identity = ensureGuestIdentity();
    const payload: QueueJoinPayload = {
      mode: "casual",
      nickname: identity.nickname,
      guestId: identity.guestId,
    };
    resetMatchmakingState();
    clearTransitionTimers();
    runScreenTransition(t("searching"), () => {
      setActiveRoomStart(null);
      setSelectedMode(null);
      setView("matchmaking");
      void emitQueueJoin(payload);
    });
  };


  const cancelMatchmaking = () => {
    clearRoomReadyTimer();
    pendingQueueJoinRef.current = null;

    if (socket.connected) {
      socket.emit("queue:cancel");
    } else {
      socket.disconnect();
    }

    runScreenTransition(t("loading"), () => {
      resetMatchmakingState();
      setView("menu");
    });
  };

  useEffect(() => {
    resetMatchmakingStateRef.current = resetMatchmakingState;
    runScreenTransitionRef.current = runScreenTransition;
  });

  useEffect(() => {
    const handleConnect = () => {
      const pendingJoin = pendingQueueJoinRef.current;
      if (!pendingJoin) return;
      socket.emit("queue:join", pendingJoin);
      pendingQueueJoinRef.current = null;
    };

    const handleConnectError = (error: Error) => {
      console.error("[socket:connect_error]", error.message);
      if (viewRef.current !== "matchmaking") return;
      setMatchmakingStatus("QUEUE ERROR");
      setMatchmakingDetail(error.message || t("connectingToServer"));
    };

    const handleDisconnect = (reason: string) => {
      console.warn("[socket:disconnect]", reason);
      if (viewRef.current !== "matchmaking") return;
      if (pendingQueueJoinRef.current == null) return;
      setMatchmakingStatus("QUEUE ERROR");
      setMatchmakingDetail(reason);
    };

    const handleQueueJoined = () => {
      setQueueSeconds(0);
      setAiMatchDeployed(false);
      setMatchmakingStatus(t("matchmaking"));
      setMatchmakingDetail(t("searchingOpponent"));
    };

    const handleQueueTick = ({ elapsed }: QueueTickPayload) => {
      setQueueSeconds(elapsed);
    };

    const handleQueueCancelled = () => {
      if (viewRef.current !== "matchmaking") return;
      resetMatchmakingStateRef.current();
      setView("menu");
    };

    const handleMatchFound = ({ roomId, opponent }: MatchFoundPayload) => {
      console.log("[match:found] received", roomId, opponent.nickname);
      setAiMatchDeployed(false);
      setMatchmakingStatus(t("matchFound"));
      setMatchmakingDetail(`${opponent.nickname} linked. Synchronizing arena...`);
      clearRoomReadyTimer();
      roomReadyTimerRef.current = window.setTimeout(() => {
        socket.emit("room:ready", { roomId });
        roomReadyTimerRef.current = null;
      }, 280);
    };

    const handleAiFallback = ({ roomId, opponent }: MatchAiFallbackPayload) => {
      console.log("[match:ai_fallback] received", roomId, opponent.nickname);
      setAiMatchDeployed(true);
      setMatchmakingStatus(t("aiMatch"));
      setMatchmakingDetail(`${opponent.nickname} deployed.`);
      clearRoomReadyTimer();
      roomReadyTimerRef.current = window.setTimeout(() => {
        socket.emit("room:ready", { roomId });
        roomReadyTimerRef.current = null;
      }, 850);
    };

    const handleRoundPayload = (eventName: "room:start" | "round:start", payload: RoomStartPayload) => {
      console.log(`[${eventName}] received`, payload.roomId, "round:", payload.round, "seed:", payload.seed);
      clearTransitionTimers();
      // 리매치: 이미 게임 뷰에 있으면 화면 전환 없이 room 데이터만 교체
      if (selectedModeRef.current !== null) {
        setActiveRoomStart(payload);
        return;
      }
      const isBotMatch = payload.players.some((player) => player.isBot);
      runScreenTransitionRef.current(isBotMatch ? t("deployingAi") : t("loading"), () => {
        resetMatchmakingStateRef.current();
        setActiveRoomStart(payload);
        setView("menu");
        setSelectedMode("casual");
      });
    };

    const handleRoomStart = (payload: RoomStartPayload) => {
      handleRoundPayload("room:start", payload);
    };

    const handleRoundStart = (payload: RoomStartPayload) => {
      handleRoundPayload("round:start", payload);
    };

    const handleSocketError = ({ message }: ErrorPayload) => {
      console.error(message);
      if (viewRef.current !== "matchmaking") return;
      setMatchmakingStatus("QUEUE ERROR");
      setMatchmakingDetail(message);
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("queue:joined", handleQueueJoined);
    socket.on("queue:tick", handleQueueTick);
    socket.on("queue:cancelled", handleQueueCancelled);
    socket.on("match:found", handleMatchFound);
    socket.on("match:ai_fallback", handleAiFallback);
    socket.on("room:start", handleRoomStart);
    socket.on("round:start", handleRoundStart);
    socket.on("error", handleSocketError);

    return () => {
      clearRoomReadyTimer();
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("queue:joined", handleQueueJoined);
      socket.off("queue:tick", handleQueueTick);
      socket.off("queue:cancelled", handleQueueCancelled);
      socket.off("match:found", handleMatchFound);
      socket.off("match:ai_fallback", handleAiFallback);
      socket.off("room:start", handleRoomStart);
      socket.off("round:start", handleRoundStart);
      socket.off("error", handleSocketError);
    };
  }, []);

  const content = selectedMode !== null ? (
      <GameCanvas
        mode={selectedMode}
        roomStart={activeRoomStart}
        guestId={guestId}
        settings={settings}
        onBattleTrackChange={setBattleTrackIndex}
        onExit={() => {
          runScreenTransition(t("loading"), () => {
            setActiveRoomStart(null);
            setSelectedMode(null);
            setView("menu");
          });
        }}
        onGoToQueue={goToMatchmakingFromGame}
      />
    ) : view === "settings" ? (
      <SettingsView
        settings={settings}
        nickname={guestNickname}
        listeningKey={listeningKey}
        particleCount={particleCount}
        onBack={() => {
          setListeningKey(null);
          runScreenTransition(t("loading"), () => setView("menu"));
        }}
        onChange={setSettings}
        onChangeNickname={updateGuestNickname}
        onStartListening={setListeningKey}
      />
    ) : view === "help" ? (
      <HelpView
        particleCount={particleCount}
        onBack={() => runScreenTransition(t("loading"), () => setView("menu"))}
      />
    ) : view === "matchmaking" ? (
      <MatchmakingView
        nickname={guestNickname || "Guest_00"}
        particleCount={particleCount}
        elapsedSeconds={queueSeconds}
        statusLabel={matchmakingStatus}
        detailLabel={matchmakingDetail}
        actionLabel={matchmakingStatus === "QUEUE ERROR" ? t("mainMenu") : t("cancel")}
        aiDeployed={aiMatchDeployed}
        onCancel={cancelMatchmaking}
      />
    ) : (
      <MainMenu
        nickname={guestNickname || "Guest_00"}
        particleCount={particleCount}
        onOpenSettings={() => runScreenTransition(t("loading"), () => setView("settings"))}
        onOpenHelp={() => runScreenTransition(t("loading"), () => setView("help"))}
        onQueueStart={beginMatchmaking}
        onStartGame={(mode) => runScreenTransition(t("loading"), () => {
          setActiveRoomStart(null);
          setSelectedMode(mode);
        })}
      />
    );

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
