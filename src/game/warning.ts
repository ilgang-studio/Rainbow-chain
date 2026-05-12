// 공간 봉쇄형 경고 시스템 (아레나 벽에서 밀려드는 형태)

import type { Arena } from "./arena";

export type WallSide = "top" | "bottom" | "left" | "right";
type Phase = "slide" | "flash" | "chain";

interface Zone {
  side: WallSide;
  arenaIdx: 0 | 1;
  phase: Phase;
  elapsed: number;
}

const SLIDE_DURATION  = 1.6;
const FLASH_DURATION  = 0.6;
const CHAIN_DURATION  = 3.0;
const SPAWN_INTERVAL  = 4.5;
const THICKNESS_RATIO = 0.35; // 아레나 크기 대비 봉쇄 두께

const SIDES: WallSide[] = ["top", "bottom", "left", "right"];
const zones: Zone[] = [];
// 두 아레나 독립적으로 타이머 관리 (약간 엇갈리게 시작)
const spawnTimers: [number, number] = [
  Math.random() * 2,
  SPAWN_INTERVAL * 0.5 + Math.random() * 2,
];

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function updateWarnings(dt: number): void {
  for (let i = 0; i < 2; i++) {
    spawnTimers[i] += dt;
    if (spawnTimers[i] >= SPAWN_INTERVAL) {
      spawnTimers[i] = 0;
      const side = SIDES[Math.floor(Math.random() * SIDES.length)];
      zones.push({ side, arenaIdx: i as 0 | 1, phase: "slide", elapsed: 0 });
    }
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.elapsed += dt;
    if (z.phase === "slide" && z.elapsed >= SLIDE_DURATION) {
      z.phase = "flash"; z.elapsed = 0;
    } else if (z.phase === "flash" && z.elapsed >= FLASH_DURATION) {
      z.phase = "chain"; z.elapsed = 0;
    } else if (z.phase === "chain" && z.elapsed >= CHAIN_DURATION) {
      zones.splice(i, 1);
    }
  }
}

function getCurrentThick(z: Zone, arena: Arena): number {
  const max = Math.min(arena.w, arena.h) * THICKNESS_RATIO;
  if (z.phase === "slide") return max * easeOut(z.elapsed / SLIDE_DURATION);
  return max;
}

// 경고 직사각형 [x, y, w, h] — 아레나 좌표 기준
function zoneRect(side: WallSide, a: Arena, thick: number): [number, number, number, number] {
  switch (side) {
    case "top":    return [a.x,             a.y,             a.w,   thick];
    case "bottom": return [a.x,             a.y + a.h - thick, a.w, thick];
    case "left":   return [a.x,             a.y,             thick,  a.h];
    case "right":  return [a.x + a.w - thick, a.y,           thick,  a.h];
  }
}

// safe zone과의 내부 경계선 (사슬 생성 위치)
function innerEdge(side: WallSide, a: Arena, thick: number) {
  switch (side) {
    case "top":    return { x1: a.x,             y1: a.y + thick,       x2: a.x + a.w,           y2: a.y + thick       };
    case "bottom": return { x1: a.x,             y1: a.y + a.h - thick, x2: a.x + a.w,           y2: a.y + a.h - thick };
    case "left":   return { x1: a.x + thick,     y1: a.y,               x2: a.x + thick,          y2: a.y + a.h         };
    case "right":  return { x1: a.x + a.w - thick, y1: a.y,             x2: a.x + a.w - thick,    y2: a.y + a.h         };
  }
}

function drawChainLinks(
  ctx: CanvasRenderingContext2D,
  side: WallSide,
  arena: Arena,
  thick: number,
  alpha: number,
): void {
  const edge = innerEdge(side, arena, thick);
  const isHoriz = side === "top" || side === "bottom";
  const lineLen = isHoriz ? arena.w : arena.h;

  const linkR   = 5;
  const spacing = 20;
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
    const cx = isHoriz ? edge.x1 + pos : edge.x1;
    const cy = isHoriz ? edge.y1       : edge.y1 + pos;

    ctx.beginPath();
    ctx.arc(cx, cy, linkR, 0, Math.PI * 2);
    ctx.stroke();

    if (i < count - 1) {
      const npos = startPos + (i + 1) * spacing;
      const nx = isHoriz ? edge.x1 + npos : edge.x1;
      const ny = isHoriz ? edge.y1        : edge.y1 + npos;
      ctx.beginPath();
      ctx.moveTo(isHoriz ? cx + linkR : cx, isHoriz ? cy : cy + linkR);
      ctx.lineTo(isHoriz ? nx - linkR : nx, isHoriz ? ny : ny - linkR);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawWarnings(ctx: CanvasRenderingContext2D, arenas: [Arena, Arena]): void {
  for (const z of zones) {
    const arena = arenas[z.arenaIdx];
    const thick = getCurrentThick(z, arena);
    const [rx, ry, rw, rh] = zoneRect(z.side, arena, thick);
    const edge = innerEdge(z.side, arena, thick);

    // 아레나 경계 안으로 클리핑 (shadowBlur 넘침 방지)
    ctx.save();
    ctx.beginPath();
    ctx.rect(arena.x, arena.y, arena.w, arena.h);
    ctx.clip();

    if (z.phase === "slide") {
      const t = easeOut(z.elapsed / SLIDE_DURATION);

      // 봉쇄 영역 진한 채움
      ctx.save();
      ctx.globalAlpha = t * 0.45;
      ctx.fillStyle = "#cc0808";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 24;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();

      // 내부 경계 네온 라인
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

      if (t > 0.5) {
        drawChainLinks(ctx, z.side, arena, thick, (t - 0.5) * 2 * 0.5);
      }

    } else if (z.phase === "flash") {
      const fp    = z.elapsed / FLASH_DURATION;
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

      drawChainLinks(ctx, z.side, arena, thick, pulse * 0.8);

    } else { // chain
      const fadeOut = z.elapsed > CHAIN_DURATION * 0.7
        ? 1 - (z.elapsed - CHAIN_DURATION * 0.7) / (CHAIN_DURATION * 0.3)
        : 1.0;

      ctx.save();
      ctx.globalAlpha = fadeOut * 0.35;
      ctx.fillStyle = "#770000";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();

      drawChainLinks(ctx, z.side, arena, thick, fadeOut);
    }

    ctx.restore(); // clip 해제
  }
}
