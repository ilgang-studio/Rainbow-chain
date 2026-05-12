import { Player, updatePlayer, drawPlayer } from "./player";

const MAX_DT = 1 / 30; // 프레임 급락 시 dt를 최대 33ms로 제한 (튀는 이동 방지)

export function startGameLoop(
  canvas: HTMLCanvasElement,
  players: [Player, Player]
): () => void {
  const ctx = canvas.getContext("2d")!;
  let rafId = 0;
  let lastTime = performance.now();

  function tick(now: number) {
    // deltaTime 계산 (초 단위, 최대값 제한)
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;

    const { width, height } = canvas;

    // 배경 지우기
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    // 플레이어 업데이트 및 렌더링
    for (const player of players) {
      updatePlayer(player, dt, width, height);
      drawPlayer(ctx, player);
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  // cleanup: 게임 루프 정지
  return () => cancelAnimationFrame(rafId);
}
