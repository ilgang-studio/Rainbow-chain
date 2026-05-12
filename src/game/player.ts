import { isKeyDown } from "./input";

export interface Player {
  x: number;
  y: number;
  radius: number;
  speed: number; // px/sec
  color: string;
  // 각 플레이어의 이동 키 바인딩
  keys: {
    up: string;
    down: string;
    left: string;
    right: string;
  };
}

export function createPlayers(canvasWidth: number, canvasHeight: number): [Player, Player] {
  const player1: Player = {
    x: canvasWidth * 0.35,
    y: canvasHeight / 2,
    radius: 16,
    speed: 300,
    color: "#ffffff",
    keys: { up: "w", down: "s", left: "a", right: "d" },
  };

  const player2: Player = {
    x: canvasWidth * 0.65,
    y: canvasHeight / 2,
    radius: 16,
    speed: 300,
    color: "#ffffff",
    keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" },
  };

  return [player1, player2];
}

export function updatePlayer(player: Player, dt: number, canvasWidth: number, canvasHeight: number): void {
  const dist = player.speed * dt;

  if (isKeyDown(player.keys.up))    player.y -= dist;
  if (isKeyDown(player.keys.down))  player.y += dist;
  if (isKeyDown(player.keys.left))  player.x -= dist;
  if (isKeyDown(player.keys.right)) player.x += dist;

  // 화면 경계 클램핑 (플레이어가 화면 밖으로 나가지 않음)
  player.x = Math.max(player.radius, Math.min(canvasWidth  - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvasHeight - player.radius, player.y));
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
  ctx.save();
  // 네온 글로우 효과: shadowBlur를 fill 전에 설정해야 적용됨
  ctx.shadowColor = player.color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore(); // shadowBlur 등 상태 오염 방지
}
