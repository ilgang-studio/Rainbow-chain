import type { Player } from "./player";
import { updatePlayer, drawPlayer } from "./player";
import type { Arena } from "./arena";
import { drawArena } from "./arena";
import { updateWarnings, drawWarnings, getActiveChains, resetWarnings, fireChain } from "./warning";
import { createItems, updateItems, drawItems, tryPickup, resetItems } from "./item";

const MAX_DT = 1 / 30;

// 체인 보유 중일 때 플레이어 주위에 표시하는 링
function drawChainRing(ctx: CanvasRenderingContext2D, player: Player): void {
  const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 1000 * 4);
  ctx.save();
  ctx.strokeStyle = "#00ffcc";
  ctx.shadowColor = "#00ffcc";
  ctx.shadowBlur  = 14 * pulse;
  ctx.lineWidth   = 2;
  ctx.globalAlpha = 0.75 * pulse;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function startGameLoop(
  canvas: HTMLCanvasElement,
  players: [Player, Player],
  arenas: [Arena, Arena],
): () => void {
  const ctx   = canvas.getContext("2d")!;
  let rafId   = 0;
  let lastTime = performance.now();
  let isGameOver  = false;
  let deadIdx: 0 | 1 | null = null;

  const items = createItems(arenas);

  function resetGame(): void {
    for (let i = 0; i < 2; i++) {
      players[i].x = arenas[i].x + arenas[i].w / 2;
      players[i].y = arenas[i].y + arenas[i].h / 2;
      players[i].hasChain = false;
    }
    resetWarnings();
    resetItems(items, arenas);
    isGameOver = false;
    deadIdx    = null;
  }

  function checkCollisions(): void {
    for (const chain of getActiveChains()) {
      const p = players[chain.arenaIdx];
      const dist = chain.orientation === "vertical"
        ? Math.abs(p.x - chain.centerPos)
        : Math.abs(p.y - chain.centerPos);
      if (dist < p.radius) {
        isGameOver = true;
        deadIdx    = chain.arenaIdx;
        return;
      }
    }
  }

  function drawGameOver(): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;

    ctx.fillStyle   = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur  = 28;
    ctx.font = "bold 72px monospace";
    ctx.fillText("GAME OVER", cx, cy - 52);

    ctx.shadowBlur = 12;
    ctx.font = "28px monospace";
    ctx.fillText(
      deadIdx === 0 ? "PLAYER 1  DEFEATED" : "PLAYER 2  DEFEATED",
      cx, cy + 14,
    );

    ctx.shadowBlur = 0;
    ctx.fillStyle  = "#666666";
    ctx.font = "18px monospace";
    ctx.fillText("Press  R  to restart", cx, cy + 66);
    ctx.restore();
  }

  const onKey = (e: KeyboardEvent) => {
    // 재시작
    if (e.key === "r" || e.key === "R") {
      if (isGameOver) resetGame();
      return;
    }
    if (isGameOver) return;

    // 체인 발동: 해당 플레이어가 체인 보유 중일 때만
    for (let i = 0; i < 2; i++) {
      if (e.key === players[i].useKey && players[i].hasChain) {
        players[i].hasChain = false;
        fireChain((1 - i) as 0 | 1, arenas);  // 상대 아레나에 발동
      }
    }
  };
  window.addEventListener("keydown", onKey);

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;

    // ── 배경 ────────────────────────────────
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── 아레나 테두리 ────────────────────────
    for (const arena of arenas) drawArena(ctx, arena);

    if (!isGameOver) {
      // ── 아이템 업데이트 ────────────────────
      updateItems(items, dt, arenas);

      // ── 아이템 획득 판정 ───────────────────
      for (let i = 0; i < 2; i++) {
        if (!players[i].hasChain && tryPickup(items[i], players[i])) {
          players[i].hasChain = true;
        }
      }

      // ── 경고 / 사슬 업데이트 ───────────────
      updateWarnings(dt, arenas);

      // ── 플레이어 이동 ──────────────────────
      updatePlayer(players[0], dt, arenas[0]);
      updatePlayer(players[1], dt, arenas[1]);

      // ── 충돌 판정 ──────────────────────────
      checkCollisions();
    }

    // ── 렌더링 ──────────────────────────────
    drawWarnings(ctx, arenas);
    drawItems(ctx, items);

    for (let i = 0; i < 2; i++) {
      drawPlayer(ctx, players[i]);
      if (players[i].hasChain) drawChainRing(ctx, players[i]);
    }

    // ── 게임 오버 오버레이 ───────────────────
    if (isGameOver) drawGameOver();

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKey);
  };
}
