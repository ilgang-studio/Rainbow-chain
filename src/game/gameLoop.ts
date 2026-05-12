import type { Player } from "./player";
import { updatePlayer, drawPlayer } from "./player";
import type { Arena } from "./arena";
import { drawArena } from "./arena";
import { updateWarnings, drawWarnings } from "./warning";

const MAX_DT = 1 / 30;

export function startGameLoop(
  canvas: HTMLCanvasElement,
  players: [Player, Player],
  arenas: [Arena, Arena],
): () => void {
  const ctx = canvas.getContext("2d")!;
  let rafId = 0;
  let lastTime = performance.now();

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;

    // 배경
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 아레나 테두리
    for (const arena of arenas) drawArena(ctx, arena);

    // 경고 영역
    updateWarnings(dt);
    drawWarnings(ctx, arenas);

    // 플레이어 (각자 자신의 아레나 안에서 이동)
    updatePlayer(players[0], dt, arenas[0]);
    updatePlayer(players[1], dt, arenas[1]);
    drawPlayer(ctx, players[0]);
    drawPlayer(ctx, players[1]);

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
