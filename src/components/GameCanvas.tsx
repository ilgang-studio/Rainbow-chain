import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { initInput } from "../game/input";
import { createArenas } from "../game/arena";
import { ENCOUNTERS, type EncounterConfig } from "../game/encounter";
import { createPlayers } from "../game/player";
import { startGameLoop } from "../game/gameLoop";
import { seedRng, resetRng } from "../game/rng";
import { socket } from "../network/socket";
import type { RoomStartPayload } from "../network/events";
import { DEFAULT_BATTLE_CONFIG } from "../shared/battle";
import type { AppSettings } from "../settings";
import chainSfxTrack from "../assets/Metal-chain.mp3";

type GameMode = "casual" | "practice" | "double";
type RematchPhase = "idle" | "waiting" | "opponent_left" | "timeout";
type MatchPhase = "playing" | "round_result" | "round_countdown" | "waiting_round" | "match_result";
type MatchSide = "local" | "opponent";

interface RoundTheme {
  encounter: EncounterConfig;
  bgmTrackIndex: number;
}

const BO3_TARGET_WINS = 2;
const BATTLE_TRACK_COUNT = 3;

const BTN_STYLE: React.CSSProperties = {
  minWidth: "176px",
  padding: "14px 18px",
  border: "1px solid rgba(255,255,255,0.55)",
  background: "rgba(0,0,0,0.86)",
  color: "#fff",
  font: '700 18px/1 "Avenir Next", "Helvetica Neue", Arial, sans-serif',
  cursor: "pointer",
  boxShadow: "0 0 16px rgba(255,255,255,0.12)",
};

const MSG_STYLE: React.CSSProperties = {
  color: "#fff",
  font: '700 18px/1 "Avenir Next", "Helvetica Neue", Arial, sans-serif',
  textAlign: "center",
  letterSpacing: "0.04em",
};

function hashRoundSeed(seed: number, salt: number): number {
  let value = (seed ^ salt) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

function getRoundTheme(seed: number, roundNumber: number): RoundTheme {
  const encounterBase = hashRoundSeed(seed, 0x41c64e6d) % ENCOUNTERS.length;
  const encounterIndex = (encounterBase + roundNumber - 1) % ENCOUNTERS.length;
  const bgmBase = hashRoundSeed(seed, 0x9e3779b9) % BATTLE_TRACK_COUNT;
  return {
    encounter: ENCOUNTERS[encounterIndex] ?? ENCOUNTERS[0],
    bgmTrackIndex: (bgmBase + roundNumber - 1) % BATTLE_TRACK_COUNT,
  };
}

function getRoundSeed(seed: number, roundNumber: number): number {
  return hashRoundSeed(seed, 0x632be5ab ^ Math.imul(roundNumber, 0x9e3779b9));
}

export default function GameCanvas({
  mode = "casual",
  roomStart,
  guestId,
  settings,
  onExit,
  onGoToQueue,
  onBattleTrackChange,
}: {
  mode?: GameMode;
  roomStart?: RoomStartPayload | null;
  guestId?: string;
  settings?: AppSettings;
  onExit?: () => void;
  onGoToQueue?: () => void;
  onBattleTrackChange?: (trackIndex: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chainAudioRef = useRef<HTMLAudioElement | null>(null);
  const roomStartRef = useRef(roomStart);
  const localMatchSeedRef = useRef(Math.floor(Math.random() * 2_147_483_647));
  const matchTimersRef = useRef<number[]>([]);
  const pendingMatchResetRef = useRef(false);
  const roundNumberRef = useRef(1);
  const roundWinsRef = useRef<[number, number]>([0, 0]);
  const mountedRef = useRef(true);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverRoomId, setGameOverRoomId] = useState<string | undefined>(undefined);
  const [runId, setRunId] = useState(0);
  const [rematchPhase, setRematchPhase] = useState<RematchPhase>("idle");
  const [matchPhase, setMatchPhase] = useState<MatchPhase>("playing");
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundWins, setRoundWins] = useState<[number, number]>([0, 0]);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [roundWinnerSide, setRoundWinnerSide] = useState<MatchSide | null>(null);
  const [matchWinnerSide, setMatchWinnerSide] = useState<MatchSide | null>(null);
  const [roundTheme, setRoundTheme] = useState<RoundTheme>(() => getRoundTheme(localMatchSeedRef.current, 1));

  useEffect(() => {
    roomStartRef.current = roomStart;
  }, [roomStart]);

  useEffect(() => {
    roundNumberRef.current = roundNumber;
  }, [roundNumber]);

  useEffect(() => {
    roundWinsRef.current = roundWins;
  }, [roundWins]);

  const isOnline = mode === "casual" && roomStart != null && guestId != null;
  const opponentPlayer = isOnline
    ? roomStart!.players.find((player) => player.guestId !== guestId)
    : null;
  const opponentIsBot = opponentPlayer?.isBot ?? false;
  const isRoundRematchable = isOnline && !opponentIsBot;
  const bo3Enabled = mode !== "practice";
  const localPlayerIdx: 0 | 1 = isOnline
    ? (roomStart!.players.findIndex((player) => player.guestId === guestId) === 1 ? 1 : 0)
    : 0;

  const clearMatchTimers = () => {
    for (const timerId of matchTimersRef.current) window.clearTimeout(timerId);
    matchTimersRef.current = [];
  };

  const setRoundPresentation = (seed: number, nextRoundNumber: number) => {
    const theme = getRoundTheme(seed, nextRoundNumber);
    setRoundTheme(theme);
    onBattleTrackChange?.(theme.bgmTrackIndex);
  };

  const resetRoundSurface = () => {
    setGameOver(false);
    setGameOverRoomId(undefined);
    setRematchPhase("idle");
    setRoundWinnerSide(null);
    setCountdownValue(null);
    setMatchPhase("playing");
  };

  const beginLocalRound = (nextRoundNumber: number, resetMatch = false) => {
    if (resetMatch) {
      localMatchSeedRef.current = Math.floor(Math.random() * 2_147_483_647);
      roundWinsRef.current = [0, 0];
      setRoundWins([0, 0]);
      setMatchWinnerSide(null);
      setRoundNumber(1);
      roundNumberRef.current = 1;
      setRoundPresentation(localMatchSeedRef.current, 1);
    } else {
      setRoundNumber(nextRoundNumber);
      roundNumberRef.current = nextRoundNumber;
      setRoundPresentation(roomStart?.seed ?? localMatchSeedRef.current, nextRoundNumber);
    }
    resetRoundSurface();
    setRunId((value) => value + 1);
  };

  const restartGame = () => {
    beginLocalRound(1, true);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearMatchTimers();
    };
  }, []);

  useEffect(() => {
    const nextSeed = roomStart?.seed ?? localMatchSeedRef.current;
    if (pendingMatchResetRef.current) {
      pendingMatchResetRef.current = false;
      roundWinsRef.current = [0, 0];
      setRoundWins([0, 0]);
      setRoundNumber(1);
      roundNumberRef.current = 1;
      setMatchWinnerSide(null);
      setRoundPresentation(nextSeed, 1);
    } else {
      setRoundPresentation(nextSeed, roundNumberRef.current);
    }
    resetRoundSurface();
    return () => {
      clearMatchTimers();
    };
  }, [roomStart?.seed, roomStart?.roomId]);

  const scheduleNextRound = (nextRoundNumber: number) => {
    clearMatchTimers();
    const resultDelay = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setMatchPhase("round_countdown");
      setCountdownValue(2);
    }, 2000);

    const countdownDelay = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setCountdownValue(1);
    }, 3000);

    const nextRoundDelay = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setCountdownValue(null);
      if (isRoundRematchable && roomStartRef.current) {
        setRoundNumber(nextRoundNumber);
        roundNumberRef.current = nextRoundNumber;
        setMatchPhase("waiting_round");
        setRematchPhase("waiting");
        socket.emit("rematch:request", { roomId: roomStartRef.current.roomId });
        return;
      }
      beginLocalRound(nextRoundNumber);
    }, 4000);

    matchTimersRef.current.push(resultDelay, countdownDelay, nextRoundDelay);
  };

  const resolveRound = (deadIdx: 0 | 1) => {
    const winnerSide: MatchSide = deadIdx === localPlayerIdx ? "opponent" : "local";
    const scoreIdx = winnerSide === "local" ? 0 : 1;
    const nextWins: [number, number] = [...roundWinsRef.current];
    nextWins[scoreIdx] += 1;
    roundWinsRef.current = nextWins;
    setRoundWins(nextWins);
    setRoundWinnerSide(winnerSide);
    setMatchPhase("round_result");

    if (!bo3Enabled || nextWins[scoreIdx] >= BO3_TARGET_WINS) {
      clearMatchTimers();
      const timerId = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setMatchWinnerSide(winnerSide);
        setMatchPhase("match_result");
      }, bo3Enabled ? 2000 : 0);
      matchTimersRef.current.push(timerId);
      return;
    }

    scheduleNextRound(roundNumberRef.current + 1);
  };

  useEffect(() => {
    if (!isRoundRematchable) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = socket as any;
    let redirectTimer: number | null = null;

    const handleRematchWaiting = () => {
      setRematchPhase("waiting");
    };

    const handleRematchAccepted = () => {
      if (redirectTimer !== null) window.clearTimeout(redirectTimer);
    };

    const handleRematchTimeout = () => {
      setRematchPhase("timeout");
      redirectTimer = window.setTimeout(() => {
        redirectTimer = null;
        onGoToQueue?.();
      }, 2000);
    };

    const handleOpponentLeft = () => {
      setRematchPhase("opponent_left");
      redirectTimer = window.setTimeout(() => {
        redirectTimer = null;
        onGoToQueue?.();
      }, 2500);
    };

    sock.on("rematch:waiting", handleRematchWaiting);
    sock.on("rematch:accepted", handleRematchAccepted);
    sock.on("rematch:timeout", handleRematchTimeout);
    sock.on("opponent:left", handleOpponentLeft);

    return () => {
      if (redirectTimer !== null) window.clearTimeout(redirectTimer);
      sock.off("rematch:waiting", handleRematchWaiting);
      sock.off("rematch:accepted", handleRematchAccepted);
      sock.off("rematch:timeout", handleRematchTimeout);
      sock.off("opponent:left", handleOpponentLeft);
    };
  }, [isRoundRematchable, onGoToQueue]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!chainAudioRef.current) {
      chainAudioRef.current = new Audio(chainSfxTrack);
      chainAudioRef.current.preload = "auto";
    }

    const playChainSfx = () => {
      const volume = Math.max(0, Math.min(1, (settings?.sfxVolume ?? 82) / 100)) * 0.58;
      if (volume <= 0.001 || !chainAudioRef.current) return;
      const clip = chainAudioRef.current.cloneNode(true) as HTMLAudioElement;
      clip.volume = volume;
      void clip.play().catch(() => {});
    };

    const battleConfig = isOnline ? roomStart!.battleConfig : DEFAULT_BATTLE_CONFIG;
    const logicalW = battleConfig.worldWidth;
    const logicalH = battleConfig.worldHeight;
    canvas.width = logicalW;
    canvas.height = logicalH;

    const applyScale = () => {
      const scale = Math.min(window.innerWidth / logicalW, window.innerHeight / logicalH);
      const w = Math.floor(logicalW * scale);
      const h = Math.floor(logicalH * scale);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.left = `${Math.floor((window.innerWidth - w) / 2)}px`;
      canvas.style.top = `${Math.floor((window.innerHeight - h) / 2)}px`;
    };

    applyScale();
    window.addEventListener("resize", applyScale);

    const cleanupInput = initInput();
    const arenas = createArenas(logicalW, logicalH, mode);

    if (isOnline) {
      seedRng(getRoundSeed(roomStart!.seed, roundNumber));
    } else {
      seedRng(getRoundSeed(localMatchSeedRef.current, roundNumber));
    }

    const players = createPlayers(
      arenas,
      mode === "double"
        ? { up: "w", down: "s", left: "a", right: "d", use: "q" }
        : settings?.controls,
    );

    if (mode === "double") {
      players[1].useKey = "/";
    }

    if (isOnline && localPlayerIdx === 1 && settings?.controls) {
      const controls = settings.controls;
      players[1].keys = {
        up: controls.up,
        down: controls.down,
        left: controls.left,
        right: controls.right,
      };
      players[1].useKey = controls.use;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = socket as any;
    const onlineOptions = isOnline && opponentPlayer ? {
      localIdx: localPlayerIdx,
      myGuestId: guestId!,
      opponentGuestId: opponentPlayer.guestId,
      emit: (event: string, data: unknown) => sock.emit(event, data),
      on: (event: string, fn: (data: unknown) => void) => sock.on(event, fn),
      off: (event: string, fn: (data: unknown) => void) => sock.off(event, fn),
    } : undefined;

    const cleanupLoop = startGameLoop(canvas, players, arenas, {
      enableAi: mode === "casual" && (!isOnline || opponentIsBot),
      practiceMode: mode === "practice",
      onChainLaunch: playChainSfx,
      onRestartRequest: restartGame,
      online: onlineOptions,
      battleConfig,
      encounterTheme: roundTheme.encounter,
      initialBattleState: roomStart?.initialBattleState,
      initialItem: roomStart?.initialItem,
    }, ({ isGameOver, deadIdx }) => {
      setGameOver(isGameOver);
      if (!isGameOver || deadIdx == null) return;
      setGameOverRoomId(roomStart?.roomId);
      setRematchPhase("idle");
      resolveRound(deadIdx);
    });

    return () => {
      window.removeEventListener("resize", applyScale);
      cleanupInput();
      cleanupLoop();
      if (isOnline) resetRng();
    };
  }, [mode, settings, runId, guestId, roomStart, isOnline, opponentIsBot, localPlayerIdx, opponentPlayer, roundTheme.encounter, roundNumber]);

  const myScore = roundWins[0];
  const opponentScore = roundWins[1];
  const finalOutcome = matchWinnerSide == null
    ? null
    : matchWinnerSide === "local"
      ? t("victory")
      : t("defeat");
  const scoreLine = `${t("youShort")} ${myScore}  -  ${t("opponentShort")} ${opponentScore}`;

  const renderGameOverOverlay = () => {
    if (!gameOver || gameOverRoomId !== roomStart?.roomId) return null;

    const containerStyle: React.CSSProperties = {
      position: "fixed",
      left: "50%",
      bottom: "14vh",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      zIndex: 20,
    };

    if (matchPhase === "round_result") {
      return (
        <div style={containerStyle}>
          <p style={{ ...MSG_STYLE, fontSize: "15px", opacity: 0.72 }}>{t("roundResult")}</p>
          <p style={{ ...MSG_STYLE, fontSize: "42px", lineHeight: 1.05 }}>
            {roundWinnerSide === "local" ? t("victory") : t("defeat")}
          </p>
          <p style={{ ...MSG_STYLE, fontSize: "20px" }}>{scoreLine}</p>
        </div>
      );
    }

    if (matchPhase === "round_countdown") {
      return (
        <div style={containerStyle}>
          <p style={{ ...MSG_STYLE, fontSize: "15px", opacity: 0.72 }}>{t("roundResult")}</p>
          <p style={{ ...MSG_STYLE, fontSize: "32px" }}>{t("nextRoundIn", { count: countdownValue ?? 1 })}</p>
          <p style={{ ...MSG_STYLE, fontSize: "18px", opacity: 0.82 }}>{t("round")} {roundNumber + 1}</p>
        </div>
      );
    }

    if (matchPhase === "waiting_round") {
      return (
        <div style={containerStyle}>
          <p style={{ ...MSG_STYLE, fontSize: "15px", opacity: 0.72 }}>{t("roundResult")}</p>
          <p style={MSG_STYLE}>
            {rematchPhase === "opponent_left"
              ? t("opponentLeft")
              : rematchPhase === "timeout"
                ? t("searchingNewMatch")
                : t("preparingNextRound")}
          </p>
        </div>
      );
    }

    if (matchPhase === "match_result") {
      if (isRoundRematchable && rematchPhase === "waiting") {
        return (
          <div style={containerStyle}>
            <p style={{ ...MSG_STYLE, fontSize: "15px", opacity: 0.72 }}>{t("finalScore")}</p>
            <p style={{ ...MSG_STYLE, fontSize: "42px", lineHeight: 1.05 }}>{finalOutcome}</p>
            <p style={{ ...MSG_STYLE, fontSize: "22px" }}>{scoreLine}</p>
            <p style={MSG_STYLE}>{t("waitingForOpponent")}</p>
            <button type="button" style={{ ...BTN_STYLE, minWidth: "140px" }} onClick={() => onExit?.()}>
              {t("mainMenu")}
            </button>
          </div>
        );
      }

      return (
        <div style={containerStyle}>
          <p style={{ ...MSG_STYLE, fontSize: "15px", opacity: 0.72 }}>{t("finalScore")}</p>
          <p style={{ ...MSG_STYLE, fontSize: "42px", lineHeight: 1.05 }}>{finalOutcome}</p>
          <p style={{ ...MSG_STYLE, fontSize: "22px" }}>{scoreLine}</p>
          <div style={{ display: "flex", gap: "16px" }}>
            <button
              type="button"
              style={BTN_STYLE}
              onClick={() => {
                if (isRoundRematchable && roomStartRef.current) {
                  pendingMatchResetRef.current = true;
                  socket.emit("rematch:request", { roomId: roomStartRef.current.roomId });
                  setRematchPhase("waiting");
                  return;
                }
                restartGame();
              }}
            >
              {t("rematch")}
            </button>
            <button type="button" style={BTN_STYLE} onClick={() => onExit?.()}>
              {t("mainMenu")}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div data-room-id={roomStart?.roomId} style={{ position: "fixed", inset: 0, background: "#000" }}>
      <div
        style={{
          position: "fixed",
          top: "82px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 18,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.9)",
            font: "bold 12px/1 monospace",
            letterSpacing: "0.36em",
            textTransform: "uppercase",
            textShadow: "0 0 10px rgba(255,255,255,0.32)",
          }}
        >
          {t("round")} {roundNumber}
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.62)",
            font: "bold 10px/1 monospace",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          {t("youShort")} / {t("opponentShort")}
        </div>
        <div
          style={{
            color: "#fff",
            font: "bold 24px/1 monospace",
            letterSpacing: "0.2em",
            textShadow: "0 0 16px rgba(255,255,255,0.5)",
          }}
        >
          {myScore} - {opponentScore}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          background: "#000",
          position: "fixed",
        }}
      />
      {renderGameOverOverlay()}
    </div>
  );
}
