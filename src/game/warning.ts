// 공간 봉쇄형 경고 시스템
// 경고 단계: 넓은 영역 반투명 + 내부 경계 네온 테두리
// 사슬 단계: 내부 경계선에 사슬 장벽 생성 후 페이드아웃

export type WallSide = "top" | "bottom" | "left" | "right";
type Phase = "warning" | "chain";

interface Zone {
  side: WallSide;
  phase: Phase;
  elapsed: number;
  duration: number;
}

const WARN_DURATION  = 2.5;  // 경고 단계 지속 (초)
const CHAIN_DURATION = 2.5;  // 사슬 장벽 유지 (초)
const FLASH_START    = 0.70; // 이 비율부터 깜빡임
const SPAWN_INTERVAL = 4.0;  // 경고 생성 주기 (초)
const THICKNESS_RATIO = 0.28; // 경고 영역 두께 (화면 짧은 쪽 비율)

const SIDES: WallSide[] = ["top", "bottom", "left", "right"];
const zones: Zone[] = [];
let timeSinceSpawn = 0;

export function updateWarnings(dt: number): void {
  timeSinceSpawn += dt;

  if (timeSinceSpawn >= SPAWN_INTERVAL) {
    timeSinceSpawn = 0;
    const side = SIDES[Math.floor(Math.random() * SIDES.length)];
    zones.push({ side, phase: "warning", elapsed: 0, duration: WARN_DURATION });
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    zones[i].elapsed += dt;
    if (zones[i].phase === "warning" && zones[i].elapsed >= zones[i].duration) {
      // 경고 → 사슬 장벽 전환
      zones[i].phase = "chain";
      zones[i].elapsed = 0;
      zones[i].duration = CHAIN_DURATION;
    } else if (zones[i].phase === "chain" && zones[i].elapsed >= zones[i].duration) {
      zones.splice(i, 1);
    }
  }
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

// safe zone과의 내부 경계선 (사슬 장벽 생성 위치)
function innerEdge(side: WallSide, cw: number, ch: number, thick: number) {
  switch (side) {
    case "top":    return { x1: 0,     y1: thick,      x2: cw,    y2: thick };
    case "bottom": return { x1: 0,     y1: ch - thick, x2: cw,    y2: ch - thick };
    case "left":   return { x1: thick, y1: 0,          x2: thick, y2: ch };
    case "right":  return { x1: cw - thick, y1: 0,     x2: cw - thick, y2: ch };
  }
}

// 내부 경계선을 따라 사슬 링크 그리기
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

  const linkR   = 5;   // 링크 원 반지름
  const spacing = 20;  // 링크 중심 간격
  const count   = Math.floor(lineLen / spacing);
  const startPos = (lineLen - count * spacing) / 2 + spacing / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ff6030";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#ff4010";
  ctx.shadowBlur = 14;

  for (let i = 0; i < count; i++) {
    const pos  = startPos + i * spacing;
    const cx   = isHoriz ? pos      : edge.x1;
    const cy   = isHoriz ? edge.y1  : pos;

    // 원형 링크
    ctx.beginPath();
    ctx.arc(cx, cy, linkR, 0, Math.PI * 2);
    ctx.stroke();

    // 다음 링크까지 연결선
    if (i < count - 1) {
      const npos = startPos + (i + 1) * spacing;
      const nx   = isHoriz ? npos     : edge.x1;
      const ny   = isHoriz ? edge.y1  : npos;
      ctx.beginPath();
      ctx.moveTo(isHoriz ? cx + linkR : cx, isHoriz ? cy : cy + linkR);
      ctx.lineTo(isHoriz ? nx - linkR : nx, isHoriz ? ny : ny - linkR);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawWarnings(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const thick = Math.min(width, height) * THICKNESS_RATIO;

  for (const z of zones) {
    const progress = z.elapsed / z.duration;

    if (z.phase === "warning") {
      let fillA: number;
      let borderA: number;

      if (progress < FLASH_START) {
        const t = progress / FLASH_START;
        fillA   = t * 0.22;           // 영역 채움: 최대 22% 불투명
        borderA = t * 0.90;           // 경계선: 최대 90%
      } else {
        // 마지막 30%: sin 파형 점멸
        const fp    = (progress - FLASH_START) / (1 - FLASH_START);
        const pulse = Math.abs(Math.sin(fp * Math.PI * 8));
        fillA   = (1 - fp) * 0.22 * pulse;
        borderA = (1 - fp * 0.4) * 0.90 * pulse;
      }

      const [rx, ry, rw, rh] = zoneRect(z.side, width, height, thick);
      const edge = innerEdge(z.side, width, height, thick);

      // 영역 내부 반투명 채움
      if (fillA > 0.005) {
        ctx.save();
        ctx.globalAlpha = fillA;
        ctx.fillStyle = "#bb1010";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.restore();
      }

      // 내부 경계 네온 테두리 (사슬 장벽 생성 위치 예고)
      if (borderA > 0.01) {
        ctx.save();
        ctx.globalAlpha = borderA;
        ctx.strokeStyle = "#ff5533";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#ff3311";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(edge.x1, edge.y1);
        ctx.lineTo(edge.x2, edge.y2);
        ctx.stroke();
        ctx.restore();

        // 사슬 링크 미리보기 (절반 투명도로 예고)
        drawChainLinks(ctx, z.side, width, height, thick, borderA * 0.45);
      }

    } else {
      // chain phase: 내부 경계에 사슬 장벽 표시
      const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1.0;

      const [rx, ry, rw, rh] = zoneRect(z.side, width, height, thick);

      // 봉쇄 구역 잔여 채움 (연하게)
      ctx.save();
      ctx.globalAlpha = fadeOut * 0.10;
      ctx.fillStyle = "#880800";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();

      // 완전한 사슬 장벽
      drawChainLinks(ctx, z.side, width, height, thick, fadeOut);
    }
  }
}
