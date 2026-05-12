// 공간 봉쇄형 경고 시스템
// 벽에서 안쪽으로 밀려들어오며 플레이 공간을 잠식

export type WallSide = "top" | "bottom" | "left" | "right";
type Phase = "slide" | "flash" | "chain";

interface Zone {
  side: WallSide;
  phase: Phase;
  elapsed: number;
}

// 각 단계 지속 시간 (초)
const SLIDE_DURATION = 1.6;  // 벽이 밀려들어오는 시간
const FLASH_DURATION = 0.7;  // 완전히 차오른 후 깜빡임
const CHAIN_DURATION = 3.0;  // 사슬 장벽 유지 시간

const SPAWN_INTERVAL  = 5.0;  // 경고 생성 주기 (초)
const MAX_THICK_RATIO = 0.38; // 최대 봉쇄 두께 (화면 짧은 쪽의 38%)

const SIDES: WallSide[] = ["top", "bottom", "left", "right"];
const zones: Zone[] = [];
let timeSinceSpawn = 0;

export function updateWarnings(dt: number): void {
  timeSinceSpawn += dt;

  if (timeSinceSpawn >= SPAWN_INTERVAL) {
    timeSinceSpawn = 0;
    const side = SIDES[Math.floor(Math.random() * SIDES.length)];
    zones.push({ side, phase: "slide", elapsed: 0 });
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.elapsed += dt;

    if (z.phase === "slide" && z.elapsed >= SLIDE_DURATION) {
      z.phase = "flash";
      z.elapsed = 0;
    } else if (z.phase === "flash" && z.elapsed >= FLASH_DURATION) {
      z.phase = "chain";
      z.elapsed = 0;
    } else if (z.phase === "chain" && z.elapsed >= CHAIN_DURATION) {
      zones.splice(i, 1);
    }
  }
}

// easeOutCubic: 빠르게 진입 → 부드럽게 멈춤
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// 현재 봉쇄 두께 계산 (slide 단계에서 0 → max로 성장)
function getCurrentThick(z: Zone, maxThick: number): number {
  if (z.phase === "slide") {
    return maxThick * easeOut(z.elapsed / SLIDE_DURATION);
  }
  return maxThick;
}

// 경고 직사각형 좌표 [x, y, w, h]
function zoneRect(side: WallSide, cw: number, ch: number, thick: number): [number, number, number, number] {
  switch (side) {
    case "top":    return [0,          0,          cw,    thick];
    case "bottom": return [0,          ch - thick, cw,    thick];
    case "left":   return [0,          0,          thick, ch];
    case "right":  return [cw - thick, 0,          thick, ch];
  }
}

// 내부 경계선 (사슬 장벽 생성 위치)
function innerEdge(side: WallSide, cw: number, ch: number, thick: number) {
  switch (side) {
    case "top":    return { x1: 0,          y1: thick,      x2: cw,         y2: thick      };
    case "bottom": return { x1: 0,          y1: ch - thick, x2: cw,         y2: ch - thick };
    case "left":   return { x1: thick,      y1: 0,          x2: thick,      y2: ch         };
    case "right":  return { x1: cw - thick, y1: 0,          x2: cw - thick, y2: ch         };
  }
}

// 사슬 링크 그리기
function drawChainLinks(
  ctx: CanvasRenderingContext2D,
  side: WallSide,
  cw: number,
  ch: number,
  thick: number,
  alpha: number,
): void {
  const edge = innerEdge(side, cw, ch, thick);
  const isHoriz = side === "top" || side === "bottom";
  const lineLen = isHoriz ? cw : ch;

  const linkR   = 6;
  const spacing = 22;
  const count   = Math.floor(lineLen / spacing);
  const startPos = (lineLen - count * spacing) / 2 + spacing / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ff6020";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "#ff4000";
  ctx.shadowBlur = 18;

  for (let i = 0; i < count; i++) {
    const pos = startPos + i * spacing;
    const cx = isHoriz ? pos     : edge.x1;
    const cy = isHoriz ? edge.y1 : pos;

    ctx.beginPath();
    ctx.arc(cx, cy, linkR, 0, Math.PI * 2);
    ctx.stroke();

    if (i < count - 1) {
      const npos = startPos + (i + 1) * spacing;
      const nx = isHoriz ? npos    : edge.x1;
      const ny = isHoriz ? edge.y1 : npos;
      ctx.beginPath();
      ctx.moveTo(isHoriz ? cx + linkR : cx, isHoriz ? cy : cy + linkR);
      ctx.lineTo(isHoriz ? nx - linkR : nx, isHoriz ? ny : ny - linkR);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawWarnings(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const maxThick = Math.min(width, height) * MAX_THICK_RATIO;

  for (const z of zones) {
    const thick = getCurrentThick(z, maxThick);
    const [rx, ry, rw, rh] = zoneRect(z.side, width, height, thick);
    const edge = innerEdge(z.side, width, height, thick);

    if (z.phase === "slide") {
      const t = easeOut(z.elapsed / SLIDE_DURATION);

      // 봉쇄 영역 채움: 진하게 (공간이 잠식된다는 느낌)
      ctx.save();
      ctx.globalAlpha = t * 0.45;
      ctx.fillStyle = "#cc0808";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 30;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();

      // 내부 경계 네온 라인 (봉쇄선)
      ctx.save();
      ctx.globalAlpha = t * 0.95;
      ctx.strokeStyle = "#ff4422";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#ff2200";
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.moveTo(edge.x1, edge.y1);
      ctx.lineTo(edge.x2, edge.y2);
      ctx.stroke();
      ctx.restore();

      // 사슬 미리보기 (후반부에만)
      if (t > 0.5) {
        drawChainLinks(ctx, z.side, width, height, thick, (t - 0.5) * 2 * 0.5);
      }

    } else if (z.phase === "flash") {
      const fp = z.elapsed / FLASH_DURATION;
      // 빠른 점멸: 경고 끝이 임박했음을 알림
      const pulse = 0.5 + 0.5 * Math.sin(fp * Math.PI * 10);

      ctx.save();
      ctx.globalAlpha = pulse * 0.55;
      ctx.fillStyle = "#ee0a0a";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 40;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#ff5533";
      ctx.lineWidth = 5;
      ctx.shadowColor = "#ff2200";
      ctx.shadowBlur = 36;
      ctx.beginPath();
      ctx.moveTo(edge.x1, edge.y1);
      ctx.lineTo(edge.x2, edge.y2);
      ctx.stroke();
      ctx.restore();

      drawChainLinks(ctx, z.side, width, height, thick, pulse * 0.8);

    } else {
      // chain phase: 사슬 장벽 완성, 후반 페이드아웃
      const fadeOut = z.elapsed > CHAIN_DURATION * 0.7
        ? 1 - (z.elapsed - CHAIN_DURATION * 0.7) / (CHAIN_DURATION * 0.3)
        : 1.0;

      // 봉쇄 구역 진한 채움 (공간이 막혔다는 느낌)
      ctx.save();
      ctx.globalAlpha = fadeOut * 0.35;
      ctx.fillStyle = "#770000";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();

      // 사슬 장벽
      drawChainLinks(ctx, z.side, width, height, thick, fadeOut);
    }
  }
}
