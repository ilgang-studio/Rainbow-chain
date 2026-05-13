// HUD 렌더링 — FPS, 타이머, 게임오버 오버레이, 체인 보유 링
import type { Player } from "./player";
import { CHAIN_CONFIGS } from "./warning/index";

export function drawFPS(ctx: CanvasRenderingContext2D, fps: number): void {
  ctx.save();
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  ctx.font         = "14px monospace";
  ctx.fillStyle    = fps >= 60 ? "#00ff88" : fps >= 40 ? "#ffcc00" : "#ff4444";
  ctx.fillText(`FPS: ${fps}`, 12, 12);
  ctx.restore();
}

export function drawTimer(ctx: CanvasRenderingContext2D, canvasWidth: number, gameTime: number): void {
  const mins  = Math.floor(gameTime / 60);
  const secs  = Math.floor(gameTime % 60);
  const label = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  ctx.save();
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  ctx.font         = "bold 28px monospace";
  ctx.fillStyle    = "#ffffff";
  ctx.shadowColor  = "#ffffff";
  ctx.shadowBlur   = 12;
  ctx.fillText(label, canvasWidth / 2, 18);
  ctx.restore();
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  deadIdx: 0 | 1,
): void {
  const cx = canvasWidth  / 2;
  const cy = canvasHeight / 2;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle   = "#ffffff";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur  = 28;
  ctx.font = "bold 72px monospace";
  ctx.fillText("GAME OVER", cx, cy - 52);

  ctx.shadowBlur = 12;
  ctx.font = "28px monospace";
  ctx.fillText(deadIdx === 0 ? "PLAYER 1  DEFEATED" : "PLAYER 2  DEFEATED", cx, cy + 14);

  ctx.shadowBlur = 0;
  ctx.fillStyle  = "#666666";
  ctx.font = "18px monospace";
  ctx.fillText("Press  R  to restart", cx, cy + 66);
  ctx.restore();
}

// 체인 보유 중 플레이어 주위 표시 링 — 보유 체인 타입 색상 반영
export function drawChainRing(ctx: CanvasRenderingContext2D, player: Player): void {
  const color = (CHAIN_CONFIGS[player.chainType] ?? CHAIN_CONFIGS["normal"]).linkColor;
  const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 1000 * 4);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 14 * pulse;
  ctx.lineWidth   = 2;
  ctx.globalAlpha = 0.75 * pulse;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
