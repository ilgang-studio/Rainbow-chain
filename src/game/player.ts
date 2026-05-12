import { isKeyDown } from "./input";
import type { Arena } from "./arena";

export interface Player {
  x: number;
  y: number;
  radius: number;
  speed: number; // px/sec
  color: string;
  keys: {
    up: string;
    down: string;
    left: string;
    right: string;
  };
  hasChain: boolean; // 체인 발동권 보유 여부
  useKey: string;    // 체인 발동 키
}

// 각 플레이어를 자신의 아레나 중앙에 배치
export function createPlayers(arenas: [Arena, Arena]): [Player, Player] {
  const [a1, a2] = arenas;

  const player1: Player = {
    x: a1.x + a1.w / 2,
    y: a1.y + a1.h / 2,
    radius: 16,
    speed: 300,
    color: "#ffffff",
    keys: { up: "w", down: "s", left: "a", right: "d" },
    hasChain: false,
    useKey: " ",      // Space
  };

  const player2: Player = {
    x: a2.x + a2.w / 2,
    y: a2.y + a2.h / 2,
    radius: 16,
    speed: 300,
    color: "#ffffff",
    keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" },
    hasChain: false,
    useKey: "Enter",  // Enter
  };

  return [player1, player2];
}

// 이동 경계를 아레나 안으로 제한
export function updatePlayer(player: Player, dt: number, arena: Arena): void {
  const dist = player.speed * dt;

  if (isKeyDown(player.keys.up))    player.y -= dist;
  if (isKeyDown(player.keys.down))  player.y += dist;
  if (isKeyDown(player.keys.left))  player.x -= dist;
  if (isKeyDown(player.keys.right)) player.x += dist;

  player.x = Math.max(arena.x + player.radius, Math.min(arena.x + arena.w - player.radius, player.x));
  player.y = Math.max(arena.y + player.radius, Math.min(arena.y + arena.h - player.radius, player.y));
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
  ctx.save();
  ctx.shadowColor = player.color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
