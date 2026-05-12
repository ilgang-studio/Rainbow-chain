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

const WARNING_DURATION   = 1.8;
const FLASH_DURATION     = 0.5;
const CHAIN_DURATION     = 2.8;
const SPAWN_INTERVAL     = 4.0;
const BAND_HALF_WIDTH    = 24;
const MAX_ZONES_PER_ARENA = 6;   // 동시 존 상한 — 후반 과부하 방지

const zones: Zone[] = [];
const spawnTimers: [number, number] = [1.2, SPAWN_INTERVAL * 0.5 + 0.9];

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
  return Math.max(0.8, SPAWN_INTERVAL - gameTime * 0.06);
}

function spawnCount(gameTime: number): number {
  if (gameTime >= 90) return 3;
  if (gameTime >= 45) return 2;
  return 1;
}

function spawnZone(arenaIdx: 0 | 1, arena: Arena): void {
  const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
  const pad = Math.min(arena.w, arena.h) * 0.15;
  const centerPos = orientation === "vertical"
    ? arena.x + pad + Math.random() * (arena.w - pad * 2)
    : arena.y + pad + Math.random() * (arena.h - pad * 2);
  zones.push({ orientation, centerPos, arenaIdx, phase: "warning", elapsed: 0 });
}

export function updateWarnings(dt: number, arenas: [Arena, Arena], gameTime: number): void {
  const interval = currentSpawnInterval(gameTime);
  const count    = spawnCount(gameTime);
  for (let i = 0; i < 2; i++) {
    spawnTimers[i] += dt;
    if (spawnTimers[i] < interval) continue;
    spawnTimers[i] = 0;

    // 아레나별 현재 존 수 확인 (cap 초과 시 스킵)
    let existing = 0;
    for (let j = 0; j < zones.length; j++) {
      if (zones[j].arenaIdx === i) existing++;
    }
    const toSpawn = Math.min(count, MAX_ZONES_PER_ARENA - existing);
    for (let n = 0; n < toSpawn; n++) spawnZone(i as 0 | 1, arenas[i]);
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
  spawnZone(arenaIdx, arenas[arenaIdx]);
}

// ── 내부 렌더 헬퍼 ───────────────────────────────────────────────────────────

// 경고 띠 + 중앙선 (warning / flash 단계 전용, shadowBlur 없음)
function drawBand(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const isVert = z.orientation === "vertical";

  ctx.globalAlpha = alpha * 0.28;
  ctx.fillStyle   = "#cc0000";
  if (isVert) {
    ctx.fillRect(z.centerPos - BAND_HALF_WIDTH, arena.y, BAND_HALF_WIDTH * 2, arena.h);
  } else {
    ctx.fillRect(arena.x, z.centerPos - BAND_HALF_WIDTH, arena.w, BAND_HALF_WIDTH * 2);
  }

  ctx.globalAlpha = alpha * 0.88;
  ctx.strokeStyle = "#ff5533";
  ctx.lineWidth   = 2;
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

// 체인 링크 — rect 기반 단일 fill() (arc 제거, stroke 제거)
// 회색 세그먼트를 일괄 ctx.fill() 1회로 처리
function drawChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const isVert  = z.orientation === "vertical";
  const lineLen = isVert ? arena.h : arena.w;
  const base    = isVert ? arena.y : arena.x;

  const SEG  = 9;   // 채워진 구간 길이
  const GAP  = 5;   // 빈 구간 길이
  const STEP = SEG + GAP;
  const HW   = 2;   // 링크 절반 굵기
  const count = Math.ceil(lineLen / STEP) + 1;

  ctx.globalAlpha = alpha;
  ctx.fillStyle   = "#aaaaaa";

  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const pos = base + i * STEP;
    if (isVert) {
      ctx.rect(z.centerPos - HW, pos, HW * 2, SEG);
    } else {
      ctx.rect(pos, z.centerPos - HW, SEG, HW * 2);
    }
  }
  ctx.fill();  // 체인 전체 단 1회 fill
}

// ── 메인 렌더 ────────────────────────────────────────────────────────────────
export function drawWarnings(ctx: CanvasRenderingContext2D, arenas: [Arena, Arena]): void {
  ctx.shadowBlur = 0;

  for (const z of zones) {
    const arena = arenas[z.arenaIdx];
    ctx.save();

    if (z.phase === "warning") {
      drawBand(ctx, z, arena, z.elapsed / WARNING_DURATION);

    } else if (z.phase === "flash") {
      const pulse = 0.5 + 0.5 * Math.sin((z.elapsed / FLASH_DURATION) * Math.PI * 10);
      drawBand(ctx, z, arena, pulse);
      drawChainLinks(ctx, z, arena, pulse * 0.55);

    } else { // chain — 띠 없음, 회색 링크만
      const progress = z.elapsed / CHAIN_DURATION;
      const fade = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1.0;
      drawChainLinks(ctx, z, arena, fade);
    }

    ctx.restore();
  }
}
