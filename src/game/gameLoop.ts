import type { Player } from "./player";
import { updatePlayer, drawPlayer } from "./player";
import type { Arena } from "./arena";
import { drawArena } from "./arena";
import { updateWarnings, drawWarnings, getActiveChains, resetWarnings } from "./warning";

const MAX_DT = 1 / 30;

export function startGameLoop(
  canvas: HTMLCanvasElement,
  players: [Player, Player],
  arenas: [Arena, Arena],
): () => void {
  const ctx = canvas.getContext("2d")!;
  let rafId = 0;
  let lastTime = performance.now();

  let isGameOver = false;
  let deadIdx: 0 | 1 | null = null;

  // 플레이어를 각 아레나 중앙으로 리셋
  function resetGame(): void {
    for (let i = 0; i < 2; i++) {
      players[i].x = arenas[i].x + arenas[i].w / 2;
      players[i].y = arenas[i].y + arenas[i].h / 2;
    }
    resetWarnings();
    isGameOver = false;
    deadIdx = null;
  }

  // 사슬 충돌 판정: 플레이어 중심 ↔ 사슬 중앙선 거리
  function checkCollisions(): void {
    for (const chain of getActiveChains()) {
      const p = players[chain.arenaIdx];
      const dist = chain.orientation === "vertical"
        ? Math.abs(p.x - chain.centerPos)
        : Math.abs(p.y - chain.centerPos);

      if (dist < p.radius) {
        isGameOver = true;
        deadIdx = chain.arenaIdx;
        return;
      }
    }
  }

  function drawGameOver(): void {
    ctx.save();

    // 반투명 오버레이
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;

    // GAME OVER
    ctx.fillStyle  = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur  = 28;
    ctx.font = "bold 72px monospace";
    ctx.fillText("GAME OVER", cx, cy - 52);

    // 패배 플레이어
    ctx.shadowBlur = 12;
    ctx.font = "28px monospace";
    ctx.fillText(
      deadIdx === 0 ? "PLAYER 1  DEFEATED" : "PLAYER 2  DEFEATED",
      cx, cy + 14,
    );

    // 재시작 안내
    ctx.shadowBlur = 0;
    ctx.fillStyle  = "#666666";
    ctx.font = "18px monospace";
    ctx.fillText("Press  R  to restart", cx, cy + 66);

    ctx.restore();
  }

  // R키 → 게임 오버 상태에서 재시작
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === "r" || e.key === "R") && isGameOver) resetGame();
  };
  window.addEventListener("keydown", onKey);

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;

    // ── 배경 ──────────────────────────────
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── 아레나 테두리 ──────────────────────
    for (const arena of arenas) drawArena(ctx, arena);

    // ── 경고 / 사슬 ───────────────────────
    if (!isGameOver) updateWarnings(dt, arenas);
    drawWarnings(ctx, arenas);

    // ── 플레이어 ─────────────────────────
    if (!isGameOver) {
      updatePlayer(players[0], dt, arenas[0]);
      updatePlayer(players[1], dt, arenas[1]);
      checkCollisions();
    }
    drawPlayer(ctx, players[0]);
    drawPlayer(ctx, players[1]);

    // ── 게임 오버 오버레이 ─────────────────
    if (isGameOver) drawGameOver();

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKey);
  };
}
