import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { initInput } from "../game/input";
import { createArenas } from "../game/arena";
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

export default function GameCanvas({
  mode = "casual",
  roomStart,
  guestId,
  settings,
  onExit,
  onGoToQueue,
}: {
  mode?: GameMode;
  roomStart?: RoomStartPayload | null;
  guestId?: string;
  settings?: AppSettings;
  onExit?: () => void;
  onGoToQueue?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chainAudioRef = useRef<HTMLAudioElement | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverRoomId, setGameOverRoomId] = useState<string | undefined>(undefined);
  const [runId, setRunId] = useState(0);
  const [rematchPhase, setRematchPhase] = useState<RematchPhase>("idle");
  // roomStart / guestId 스냅샷 — 리매치 이벤트 핸들러에서 최신 값 참조
  const roomStartRef = useRef(roomStart);
  const rematchPhaseRef = useRef(rematchPhase);
  useEffect(() => { roomStartRef.current = roomStart; }, [roomStart]);
  useEffect(() => { rematchPhaseRef.current = rematchPhase; }, [rematchPhase]);

  const restartGame = () => {
    setGameOver(false);
    setRunId((value) => value + 1);
    setRematchPhase("idle");
  };

  // 리매치 소켓 리스너 — gameOver가 된 후에도 유지돼야 하므로 별도 useEffect
  useEffect(() => {
    const isOnline = mode === "casual" && roomStart != null && guestId != null;
    const opponentIsBot = roomStart?.players.find((p) => p.guestId !== guestId)?.isBot ?? true;
    if (!isOnline || opponentIsBot) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = socket as any;
    let redirectTimer: number | null = null;

    const handleRematchWaiting = () => {
      setRematchPhase("waiting");
    };

    const handleRematchAccepted = () => {
      if (redirectTimer !== null) window.clearTimeout(redirectTimer);
      // room:start가 곧 도착해 setActiveRoomStart → roomStart prop 변경 → 게임 재시작
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

    sock.on("rematch:waiting",  handleRematchWaiting);
    sock.on("rematch:accepted", handleRematchAccepted);
    sock.on("rematch:timeout",  handleRematchTimeout);
    sock.on("opponent:left",    handleOpponentLeft);

    return () => {
      if (redirectTimer !== null) window.clearTimeout(redirectTimer);
      sock.off("rematch:waiting",  handleRematchWaiting);
      sock.off("rematch:accepted", handleRematchAccepted);
      sock.off("rematch:timeout",  handleRematchTimeout);
      sock.off("opponent:left",    handleOpponentLeft);
    };
  // roomStart / guestId가 바뀌면(리매치 수락 후) 리스너 재등록
  }, [mode, guestId, roomStart, onGoToQueue]);

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

    const isOnline = mode === "casual" && roomStart != null && guestId != null;
    const battleConfig = isOnline ? roomStart!.battleConfig : DEFAULT_BATTLE_CONFIG;

    // 서버 authoritative 전투는 서버 월드 해상도를 그대로 사용
    const LOGICAL_W = battleConfig.worldWidth;
    const LOGICAL_H = battleConfig.worldHeight;
    canvas.width  = LOGICAL_W;
    canvas.height = LOGICAL_H;

    const applyScale = () => {
      const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
      const w = Math.floor(LOGICAL_W * scale);
      const h = Math.floor(LOGICAL_H * scale);
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.left   = `${Math.floor((window.innerWidth  - w) / 2)}px`;
      canvas.style.top    = `${Math.floor((window.innerHeight - h) / 2)}px`;
    };
    applyScale();
    window.addEventListener("resize", applyScale);

    console.log("[GameCanvas] entering", { mode, roomId: roomStart?.roomId ?? "local" });

    // 초기화 순서: input → arenas → players → gameLoop
    const cleanupInput = initInput();
    const arenas  = createArenas(LOGICAL_W, LOGICAL_H, mode);

    const localIdx = isOnline
      ? (roomStart!.players.findIndex((p) => p.guestId === guestId) as 0 | 1)
      : 0;
    const opponentPlayer = isOnline
      ? roomStart!.players.find((p) => p.guestId !== guestId)
      : null;
    const opponentIsBot = opponentPlayer?.isBot ?? false;

    if (isOnline) seedRng(roomStart!.seed);

    const players = createPlayers(
      arenas,
      mode === "double"
        ? { up: "w", down: "s", left: "a", right: "d", use: "q" }
        : settings?.controls,
    );
    if (mode === "double") {
      players[1].useKey = "/";
    }
    // 온라인에서 localIdx=1이면 유저 키를 player[1]에 적용
    if (isOnline && localIdx === 1 && settings?.controls) {
      const c = settings.controls;
      players[1].keys = { up: c.up, down: c.down, left: c.left, right: c.right };
      players[1].useKey = c.use;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = socket as any;
    const onlineOptions = isOnline && opponentPlayer ? {
      localIdx,
      myGuestId: guestId!,
      opponentGuestId: opponentPlayer.guestId,
      emit: (ev: string, data: unknown) => sock.emit(ev, data),
      on:   (ev: string, fn: (d: unknown) => void) => sock.on(ev, fn),
      off:  (ev: string, fn: (d: unknown) => void) => sock.off(ev, fn),
    } : undefined;

    const cleanupLoop = startGameLoop(canvas, players, arenas, {
      enableAi: mode === "casual" && (!isOnline || opponentIsBot),
      practiceMode: mode === "practice",
      onChainLaunch: playChainSfx,
      onRestartRequest: restartGame,
      online: onlineOptions,
      battleConfig,
    }, (val: boolean) => {
      setGameOver(val);
      if (val) {
        setGameOverRoomId(roomStart?.roomId);
        setRematchPhase("idle");
      }
    });

    return () => {
      window.removeEventListener("resize", applyScale);
      cleanupInput();
      cleanupLoop();
      if (isOnline) resetRng();
    };
  }, [mode, settings, runId, guestId, roomStart]);

  // 게임오버 오버레이 — 온라인 리매치 vs 로컬 재시작 분기
  const isRematchable = mode === "casual"
    && roomStart != null
    && guestId != null
    && !(roomStart.players.find((p) => p.guestId !== guestId)?.isBot ?? true);

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

    if (isRematchable) {
      if (rematchPhase === "idle") {
        return (
          <div style={containerStyle}>
            <div style={{ display: "flex", gap: "16px" }}>
              <button
                type="button"
                style={BTN_STYLE}
                onClick={() => {
                  if (!roomStartRef.current) return;
                  socket.emit("rematch:request", { roomId: roomStartRef.current.roomId });
                  setRematchPhase("waiting");
                }}
              >
                {t("restart")}
              </button>
              <button type="button" style={BTN_STYLE} onClick={() => onExit?.()}>
                {t("main")}
              </button>
            </div>
          </div>
        );
      }

      if (rematchPhase === "waiting") {
        return (
          <div style={containerStyle}>
            <p style={MSG_STYLE}>{t("waitingForOpponent")}</p>
            <button
              type="button"
              style={{ ...BTN_STYLE, minWidth: "140px" }}
              onClick={() => {
                if (roomStartRef.current) {
                  socket.emit("rematch:cancel", { roomId: roomStartRef.current.roomId });
                }
                onExit?.();
              }}
            >
              {t("main")}
            </button>
          </div>
        );
      }

      if (rematchPhase === "opponent_left") {
        return (
          <div style={containerStyle}>
            <p style={MSG_STYLE}>{t("opponentLeft")}</p>
          </div>
        );
      }

      if (rematchPhase === "timeout") {
        return (
          <div style={containerStyle}>
            <p style={MSG_STYLE}>{t("searchingNewMatch")}</p>
          </div>
        );
      }
    }

    // 로컬 모드 (또는 봇 매칭)
    return (
      <div style={containerStyle}>
        <div style={{ display: "flex", gap: "16px" }}>
          <button type="button" style={BTN_STYLE} onClick={restartGame}>
            {t("restart")}
          </button>
          <button type="button" style={BTN_STYLE} onClick={() => onExit?.()}>
            {t("mainMenu")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div data-room-id={roomStart?.roomId} style={{ position: "fixed", inset: 0, background: "#000" }}>
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
