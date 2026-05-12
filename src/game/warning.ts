// 체인 경고 + 사슬 시스템
// 경고는 "사슬이 지나갈 위치 예고"이며, 실제 위험 판정은 중앙선 기준

import type { Arena } from "./arena";

export type Orientation = "horizontal" | "vertical";
type Phase = "warning" | "flash" | "chain";

export interface Zone {
  orientation: Orientation;
  centerPos: number;   // vertical → x좌표, horizontal → y좌표
  arenaIdx: 0 | 1;
  phase: Phase;
  elapsed: number;
}

const WARNING_DURATION = 1.8;  // 경고 띠 표시 시간 (초)
const FLASH_DURATION   = 0.5;  // 마지막 깜빡임 시간 (초)
const CHAIN_DURATION   = 2.8;  // 사슬 유지 시간 (초)
const SPAWN_INTERVAL   = 4.0;  // 경고 생성 주기 (초)
const BAND_HALF_WIDTH  = 24;   // 경고 띠 반폭 (px)

const zones: Zone[] = [];
// 두 아레나 타이머를 엇갈려 시작 (동시 등장 방지)
const spawnTimers: [number, number] = [1.2, SPAWN_INTERVAL * 0.5 + 0.9];

export function resetWarnings(): void {
  zones.length = 0;
  spawnTimers[0] = 1.2;
  spawnTimers[1] = SPAWN_INTERVAL * 0.5 + 0.9;
}

// 충돌 판정용: chain 단계 Zone만 반환
export function getActiveChains(): Zone[] {
  return zones.filter(z => z.phase === "chain");
}

export function updateWarnings(dt: number, arenas: [Arena, Arena]): void {
  for (let i = 0; i < 2; i++) {
    spawnTimers[i] += dt;
    if (spawnTimers[i] < SPAWN_INTERVAL) continue;

    spawnTimers[i] = 0;
    const arena = arenas[i];
    const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
    // 아레나 가장자리 15% 여백 안쪽 랜덤 위치
    const pad = Math.min(arena.w, arena.h) * 0.15;
    const centerPos = orientation === "vertical"
      ? arena.x + pad + Math.random() * (arena.w - pad * 2)
      : arena.y + pad + Math.random() * (arena.h - pad * 2);

    zones.push({ orientation, centerPos, arenaIdx: i as 0 | 1, phase: "warning", elapsed: 0 });
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.elapsed += dt;
    if      (z.phase === "warning" && z.elapsed >= WARNING_DURATION) { z.phase = "flash"; z.elapsed = 0; }
    else if (z.phase === "flash"   && z.elapsed >= FLASH_DURATION)   { z.phase = "chain"; z.elapsed = 0; }
    else if (z.phase === "chain"   && z.elapsed >= CHAIN_DURATION)   { zones.splice(i, 1); }
  }
}

// 플레이어가 체인 발동 시 상대 아레나에 경고 + 사슬 생성
export function fireChain(arenaIdx: 0 | 1, arenas: [Arena, Arena]): void {
  const arena = arenas[arenaIdx];
  const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
  const pad = Math.min(arena.w, arena.h) * 0.15;
  const centerPos = orientation === "vertical"
    ? arena.x + pad + Math.random() * (arena.w - pad * 2)
    : arena.y + pad + Math.random() * (arena.h - pad * 2);
  zones.push({ orientation, centerPos, arenaIdx, phase: "warning", elapsed: 0 });
}

// 경고 띠 직사각형 [x, y, w, h]
function bandRect(z: Zone, arena: Arena): [number, number, number, number] {
  if (z.orientation === "vertical") {
    return [z.centerPos - BAND_HALF_WIDTH, arena.y, BAND_HALF_WIDTH * 2, arena.h];
  }
  return [arena.x, z.centerPos - BAND_HALF_WIDTH, arena.w, BAND_HALF_WIDTH * 2];
}

// 반투명 띠 + 중앙선 그리기 (warning / flash 단계 공용)
function drawBand(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const [rx, ry, rw, rh] = bandRect(z, arena);

  // 반투명 빨간 띠
  ctx.save();
  ctx.globalAlpha = alpha * 0.28;
  ctx.fillStyle = "#cc0000";
  ctx.fillRect(rx, ry, rw, rh);
  ctx.restore();

  // 중앙선 (더 진하게 — "실제 위험 위치" 표시)
  ctx.save();
  ctx.globalAlpha = alpha * 0.88;
  ctx.strokeStyle = "#ff4422";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#ff2200";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  if (z.orientation === "vertical") {
    ctx.moveTo(z.centerPos, arena.y);
    ctx.lineTo(z.centerPos, arena.y + arena.h);
  } else {
    ctx.moveTo(arena.x, z.centerPos);
    ctx.lineTo(arena.x + arena.w, z.centerPos);
  }
  ctx.stroke();
  ctx.restore();
}

// 사슬 링크 그리기 (chain 단계)
function drawChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const isVert  = z.orientation === "vertical";
  const lineLen = isVert ? arena.h : arena.w;
  const base    = isVert ? arena.y : arena.x;

  const linkR   = 4;
  const spacing = 16;
  const count   = Math.floor(lineLen / spacing);
  const startPos = base + (lineLen - count * spacing) / 2 + spacing / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ff6020";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#ff4000";
  ctx.shadowBlur = 14;

  for (let i = 0; i < count; i++) {
    const pos = startPos + i * spacing;
    const cx = isVert ? z.centerPos : pos;
    const cy = isVert ? pos : z.centerPos;

    // 링크 원
    ctx.beginPath();
    ctx.arc(cx, cy, linkR, 0, Math.PI * 2);
    ctx.stroke();

    // 연결선
    if (i < count - 1) {
      const npos = startPos + (i + 1) * spacing;
      const nx = isVert ? z.centerPos : npos;
      const ny = isVert ? npos : z.centerPos;
      ctx.beginPath();
      ctx.moveTo(isVert ? cx : cx + linkR, isVert ? cy + linkR : cy);
      ctx.lineTo(isVert ? nx : nx - linkR, isVert ? ny - linkR : ny);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawWarnings(ctx: CanvasRenderingContext2D, arenas: [Arena, Arena]): void {
  for (const z of zones) {
    const arena = arenas[z.arenaIdx];

    // 아레나 경계 밖으로 넘치지 않도록 클리핑
    ctx.save();
    ctx.beginPath();
    ctx.rect(arena.x, arena.y, arena.w, arena.h);
    ctx.clip();

    if (z.phase === "warning") {
      drawBand(ctx, z, arena, z.elapsed / WARNING_DURATION);

    } else if (z.phase === "flash") {
      const pulse = 0.5 + 0.5 * Math.sin((z.elapsed / FLASH_DURATION) * Math.PI * 10);
      drawBand(ctx, z, arena, pulse);
      drawChainLinks(ctx, z, arena, pulse * 0.55);

    } else { // chain
      const progress = z.elapsed / CHAIN_DURATION;
      const fade = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1.0;

      // 잔여 띠 (매우 연하게)
      const [rx, ry, rw, rh] = bandRect(z, arena);
      ctx.save();
      ctx.globalAlpha = fade * 0.10;
      ctx.fillStyle = "#770000";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();

      drawChainLinks(ctx, z, arena, fade);
    }

    ctx.restore(); // clip 해제
  }
}
