import { useEffect, useRef } from "react";
import { initInput } from "../game/input";
import { createPlayers } from "../game/player";
import { startGameLoop } from "../game/gameLoop";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;

    // Canvas 크기를 뷰포트에 맞춤
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // 초기화 순서: input → players → gameLoop
    const cleanupInput = initInput();
    const players = createPlayers(canvas.width, canvas.height);
    const cleanupLoop = startGameLoop(canvas, players);

    return () => {
      window.removeEventListener("resize", resize);
      cleanupInput();
      cleanupLoop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        background: "#000",
        // Canvas를 뷰포트 전체에 꽉 채움
        position: "fixed",
        top: 0,
        left: 0,
      }}
    />
  );
}
