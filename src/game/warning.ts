// 체인이 날아오기 전 경고 영역 시스템
// 생성 → 점점 진해짐 → 짧게 사라짐 → 제거

export type WallSide = "top" | "bottom" | "left" | "right";

export interface Warning {
  side: WallSide;
  // 경과 시간 (초)
  elapsed: number;
  // 경고 표시 총 지속 시간 (초)
  duration: number;
}

const WARN_DURATION = 2.0;    // 경고 총 지속 시간 (초)
const FLASH_START   = 0.75;   // 이 비율 이후부터 깜빡이기 시작 (75% 지점)
const SPAWN_INTERVAL = 3.0;   // 몇 초마다 새 경고 생성 (초)

const SIDES: WallSide[] = ["top", "bottom", "left", "right"];

// 현재 활성 경고 목록
const warnings: Warning[] = [];
let timeSinceLastSpawn = 0;

export function updateWarnings(dt: number): void {
  timeSinceLastSpawn += dt;

  // 일정 시간마다 랜덤 벽에 경고 생성
  if (timeSinceLastSpawn >= SPAWN_INTERVAL) {
    timeSinceLastSpawn = 0;
    const side = SIDES[Math.floor(Math.random() * SIDES.length)];
    warnings.push({ side, elapsed: 0, duration: WARN_DURATION });
  }

  // 경고 진행 및 만료된 것 제거
  for (let i = warnings.length - 1; i >= 0; i--) {
    warnings[i].elapsed += dt;
    if (warnings[i].elapsed >= warnings[i].duration) {
      warnings.splice(i, 1);
    }
  }
}

export function drawWarnings(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  for (const w of warnings) {
    const progress = w.elapsed / w.duration; // 0 → 1

    // alpha: 서서히 진해지다가 마지막 25%에서 빠르게 깜빡임
    let alpha: number;
    if (progress < FLASH_START) {
      // 0 → FLASH_START 구간: 0.0 → 0.55 로 부드럽게 증가
      alpha = (progress / FLASH_START) * 0.55;
    } else {
      // FLASH_START → 1.0 구간: 빠른 sin 깜빡임 후 소멸
      const flashProgress = (progress - FLASH_START) / (1 - FLASH_START);
      alpha = (1 - flashProgress) * 0.55 * Math.abs(Math.sin(flashProgress * Math.PI * 6));
    }

    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 경고 띠 두께 (화면 짧은 쪽의 15%)
    const thickness = Math.min(width, height) * 0.15;

    // 네온 레드 글로우
    ctx.shadowColor = "#ff2020";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#ff1a1a";

    switch (w.side) {
      case "top":
        ctx.fillRect(0, 0, width, thickness);
        break;
      case "bottom":
        ctx.fillRect(0, height - thickness, width, thickness);
        break;
      case "left":
        ctx.fillRect(0, 0, thickness, height);
        break;
      case "right":
        ctx.fillRect(width - thickness, 0, thickness, height);
        break;
    }

    ctx.restore();
  }
}
