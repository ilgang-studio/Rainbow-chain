import { useEffect, useRef, useState } from "react";
import { initInput } from "../game/input";
import { createArenas } from "../game/arena";
import { createPlayers } from "../game/player";
import { startGameLoop } from "../game/gameLoop";
import { seedRng, resetRng } from "../game/rng";
import { socket } from "../network/socket";
import type { RoomStartPayload } from "../network/events";
import type { AppSettings } from "../settings";
import chainSfxTrack from "../assets/Metal-chain.mp3";

type GameMode = "casual" | "practice" | "double";

export default function GameCanvas({
  mode = "casual",
  roomStart,
  guestId,
  settings,
  onExit,
}: {
  mode?: GameMode;
  roomStart?: RoomStartPayload | null;
  guestId?: string;
  settings?: AppSettings;
  onExit?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chainAudioRef = useRef<HTMLAudioElement | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [runId, setRunId] = useState(0);

  const restartGame = () => {
    setGameOver(false);
    setRunId((value) => value + 1);
  };

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

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    console.log("[GameCanvas] entering", { mode, roomId: roomStart?.roomId ?? "local" });

    // 초기화 순서: input → arenas → players → gameLoop
    const cleanupInput = initInput();
    const arenas  = createArenas(canvas.width, canvas.height, mode);

    // 온라인 모드 판별
    const isOnline = mode === "casual" && roomStart != null && guestId != null;
    const localIdx = isOnline
      ? (roomStart!.players.findIndex((p) => p.guestId === guestId) as 0 | 1)
      : 0;
    const opponentPlayer = isOnline
      ? roomStart!.players.find((p) => p.guestId !== guestId)
      : null;

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

    // socket을 any로 캐스트해 이벤트 이름 동적 전달 허용
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
      enableAi: mode === "casual" && !isOnline,
      practiceMode: mode === "practice",
      onChainLaunch: playChainSfx,
      onRestartRequest: restartGame,
      online: onlineOptions,
    }, setGameOver);

    return () => {
      window.removeEventListener("resize", resize);
      cleanupInput();
      cleanupLoop();
      if (isOnline) resetRng();
    };
  }, [mode, settings, runId, guestId, roomStart]);

  return (
    <div
      data-room-id={roomStart?.roomId}
      style={{
        position: "fixed",
        inset: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          background: "#000",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
        }}
      />
      {gameOver ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "14vh",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "16px",
            zIndex: 20,
          }}
        >
          <button
            type="button"
            onClick={restartGame}
            style={{
              minWidth: "176px",
              padding: "14px 18px",
              border: "1px solid rgba(255,255,255,0.55)",
              background: "rgba(0,0,0,0.86)",
              color: "#fff",
              font: '700 18px/1 "Avenir Next", "Helvetica Neue", Arial, sans-serif',
              cursor: "pointer",
              boxShadow: "0 0 16px rgba(255,255,255,0.12)",
            }}
          >
            Restart
          </button>
          <button
            type="button"
            onClick={() => onExit?.()}
            style={{
              minWidth: "176px",
              padding: "14px 18px",
              border: "1px solid rgba(255,255,255,0.55)",
              background: "rgba(0,0,0,0.86)",
              color: "#fff",
              font: '700 18px/1 "Avenir Next", "Helvetica Neue", Arial, sans-serif',
              cursor: "pointer",
              boxShadow: "0 0 16px rgba(255,255,255,0.12)",
            }}
          >
            Main Menu
          </button>
        </div>
      ) : null}
    </div>
  );
}
