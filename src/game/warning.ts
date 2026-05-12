// 체인 경고 + 사슬 시스템 (성능 최적화)
// shadowBlur 제거, 링크 경로 일괄 stroke, save/restore 최소화

import type { Arena } from "./arena";

export type Orientation = "horizontal" | "vertical";
type Phase = "warning" | "flash" | "chain";

export interface Zone {
  orientation: Orientation;
  centerPos: number;
  arenaIdx: 0 | 1;
  phase: Phase;
  elapsed: number;
}

const WARNING_DURATION = 1.8;
const FLASH_DURATION   = 0.5;
const CHAIN_DURATION   = 2.8;
const SPAWN_INTERVAL   = 4.0;
const BAND_HALF_WIDTH  = 24;

const zones: Zone[] = [];
const spawnTimers: [number, number] = [1.2, SPAWN_INTERVAL * 0.5 + 0.9];

// filter() 대신 재사용 버퍼로 매 프레임 배열 할당 제거
const _chainBuf: Zone[] = [];
export function getActiveChains(): Zone[] {
  _chainBuf.length = 0;
  for (let i = 0; i < zones.length; i++) {
    if (zones[i].phase === "chain") _chainBuf.push(zones[i]);
  }
  return _chainBuf;
}

export function resetWarnings(): void {
  zones.length = 0;
  spawnTimers[0] = 1.2;
  spawnTimers[1] = SPAWN_INTERVAL * 0.5 + 0.9;
}

function currentSpawnInterval(gameTime: number): number {
  return Math.max(1.2, SPAWN_INTERVAL - gameTime * 0.05);
}

export function updateWarnings(dt: number, arenas: [Arena, Arena], gameTime: number): void {
  const interval = currentSpawnInterval(gameTime);
  for (let i = 0; i < 2; i++) {
    spawnTimers[i] += dt;
    if (spawnTimers[i] < interval) continue;
    spawnTimers[i] = 0;
    const arena = arenas[i];
    const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
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

export function fireChain(arenaIdx: 0 | 1, arenas: [Arena, Arena]): void {
  const arena = arenas[arenaIdx];
  const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
  const pad = Math.min(arena.w, arena.h) * 0.15;
  const centerPos = orientation === "vertical"
    ? arena.x + pad + Math.random() * (arena.w - pad * 2)
    : arena.y + pad + Math.random() * (arena.h - pad * 2);
  zones.push({ orientation, centerPos, arenaIdx, phase: "warning", elapsed: 0 });
}

// ── 내부 렌더 헬퍼 ────────────────────────────────────────────────────────────

// 경고 띠 + 중앙선 (shadowBlur 없음, save/restore 없음 — 호출부에서 관리)
function drawBand(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const isVert = z.orientation === "vertical";

  // 반투명 빨간 띠
  ctx.globalAlpha = alpha * 0.28;
  ctx.fillStyle   = "#cc0000";
  if (isVert) {
    ctx.fillRect(z.centerPos - BAND_HALF_WIDTH, arena.y, BAND_HALF_WIDTH * 2, arena.h);
  } else {
    ctx.fillRect(arena.x, z.centerPos - BAND_HALF_WIDTH, arena.w, BAND_HALF_WIDTH * 2);
  }

  // 중앙선 (더 밝은 색으로 위험 위치 표시 — glow 대신 색상으로 대체)
  ctx.globalAlpha  = alpha * 0.88;
  ctx.strokeStyle  = "#ff5533";
  ctx.lineWidth    = 2;
  ctx.beginPath();
  if (isVert) {
    ctx.moveTo(z.centerPos, arena.y);
    ctx.lineTo(z.centerPos, arena.y + arena.h);
  } else {
    ctx.moveTo(arena.x, z.centerPos);
    ctx.lineTo(arena.x + arena.w, z.centerPos);
  }
  ctx.stroke();
}

// 사슬 링크 — 모든 호 + 연결선을 단일 beginPath → stroke() 로 처리
// (링크당 stroke 호출 제거: ~60 draw call → 1 draw call per chain)
function drawChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const isVert  = z.orientation === "vertical";
  const lineLen = isVert ? arena.h : arena.w;
  const base    = isVert ? arena.y : arena.x;

  const linkR   = 4;
  const spacing = 16;
  const count   = Math.floor(lineLen / spacing);
  const start   = base + (lineLen - count * spacing) / 2 + spacing / 2;

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ff6633";
  ctx.lineWidth   = 2;

  // 링크 원 + 연결선을 하나의 경로로 일괄 처리
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const pos = start + i * spacing;
    const cx = isVert ? z.centerPos : pos;
    const cy = isVert ? pos : z.centerPos;

    // moveTo로 이전 점과의 자동 연결 방지
    ctx.moveTo(cx + linkR, cy);
    ctx.arc(cx, cy, linkR, 0, Math.PI * 2);

    if (i < count - 1) {
      const npos = start + (i + 1) * spacing;
      const nx = isVert ? z.centerPos : npos;
      const ny = isVert ? npos : z.centerPos;
      ctx.moveTo(isVert ? cx         : cx + linkR, isVert ? cy + linkR : cy);
      ctx.lineTo(isVert ? nx         : nx - linkR, isVert ? ny - linkR : ny);
    }
  }
  ctx.stroke(); // 전체 체인 단 1회 stroke
}

// ── 메인 렌더 ─────────────────────────────────────────────────────────────────
export function drawWarnings(ctx: CanvasRenderingContext2D, arenas: [Arena, Arena]): void {
  // shadowBlur가 외부에서 설정된 경우 초기화
  ctx.shadowBlur = 0;

  for (const z of zones) {
    const arena = arenas[z.arenaIdx];

    // 존당 save/restore 1회 (clip 제거: 15% 패딩으로 아레나 경계 자동 보장)
    ctx.save();

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
      const isVert = z.orientation === "vertical";
      ctx.globalAlpha = fade * 0.10;
      ctx.fillStyle   = "#770000";
      if (isVert) {
        ctx.fillRect(z.centerPos - BAND_HALF_WIDTH, arena.y, BAND_HALF_WIDTH * 2, arena.h);
      } else {
        ctx.fillRect(arena.x, z.centerPos - BAND_HALF_WIDTH, arena.w, BAND_HALF_WIDTH * 2);
      }

      drawChainLinks(ctx, z, arena, fade);
    }

    ctx.restore(); // globalAlpha 자동 복원
  }
}
