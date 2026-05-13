import { useEffect, useRef } from "react";
import { initInput } from "../game/input";
import { createArenas } from "../game/arena";
import { createPlayers } from "../game/player";
import { startGameLoop } from "../game/gameLoop";

type GameMode = "casual" | "practice";

export default function GameCanvas({ mode = "casual" }: { mode?: GameMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // 초기화 순서: input → arenas → players → gameLoop
    const cleanupInput = initInput();
    const arenas  = createArenas(canvas.width, canvas.height, mode);
    const players = createPlayers(arenas);
    const cleanupLoop = startGameLoop(canvas, players, arenas, {
      enableAi: mode !== "practice",
      practiceMode: mode === "practice",
    });

    return () => {
      window.removeEventListener("resize", resize);
      cleanupInput();
      cleanupLoop();
    };
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        background: "#000",
        position: "fixed",
        top: 0,
        left: 0,
        // CSS 크기를 명시적으로 지정 (canvas 기본값 300×150 방지)
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}
