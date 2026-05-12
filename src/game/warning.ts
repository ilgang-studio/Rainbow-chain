import type { Arena } from "./arena";

export type Orientation = "horizontal" | "vertical";
type Phase = "warning" | "flash" | "chain";

export interface Zone {
  orientation: Orientation;
  centerPos:   number;
  arenaIdx:    0 | 1;
  phase:       Phase;
  elapsed:     number;
  direction:   1 | -1;   // 1: top/left→bottom/right, -1: 반대
  drawLength:  number;   // 현재 뻗어나간 길이 (px), chain 단계에서만 유효
}

const WARNING_DURATION    = 1.8;
const FLASH_DURATION      = 0.5;
const EXTEND_DURATION     = 0.45;  // 체인이 끝까지 뻗는 시간
const HOLD_DURATION       = 1.95;  // 완전히 뻗은 뒤 유지
const FADE_DURATION       = 0.4;   // 사라지는 시간
const CHAIN_DURATION      = EXTEND_DURATION + HOLD_DURATION + FADE_DURATION; // 2.8
const SPAWN_INTERVAL      = 4.0;
const BAND_HALF_WIDTH     = 24;
const MAX_ZONES_PER_ARENA = 6;

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
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  zones.push({ orientation, centerPos, arenaIdx, phase: "warning", elapsed: 0, direction, drawLength: 0 });
}

export function updateWarnings(dt: number, arenas: [Arena, Arena], gameTime: number): void {
  const interval = currentSpawnInterval(gameTime);
  const count    = spawnCount(gameTime);
  for (let i = 0; i < 2; i++) {
    spawnTimers[i] += dt;
    if (spawnTimers[i] < interval) continue;
    spawnTimers[i] = 0;

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

    if (z.phase === "warning") {
      if (z.elapsed >= WARNING_DURATION) { z.phase = "flash"; z.elapsed = 0; }
    } else if (z.phase === "flash") {
      if (z.elapsed >= FLASH_DURATION) { z.phase = "chain"; z.elapsed = 0; z.drawLength = 0; }
    } else { // chain
      const arena   = arenas[z.arenaIdx];
      const fullLen = z.orientation === "vertical" ? arena.h : arena.w;
      z.drawLength  = z.elapsed < EXTEND_DURATION
        ? fullLen * (z.elapsed / EXTEND_DURATION)
        : fullLen;
      if (z.elapsed >= CHAIN_DURATION) zones.splice(i, 1);
    }
  }
}

export function fireChain(arenaIdx: 0 | 1, arenas: [Arena, Arena]): void {
  spawnZone(arenaIdx, arenas[arenaIdx]);
}

// ── 내부 렌더 헬퍼 ───────────────────────────────────────────────────────────

// 경고 띠 + 중앙선 — 회색 (warning / flash 단계)
function drawBand(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const isVert = z.orientation === "vertical";

  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle   = "#888888";
  if (isVert) {
    ctx.fillRect(z.centerPos - BAND_HALF_WIDTH, arena.y, BAND_HALF_WIDTH * 2, arena.h);
  } else {
    ctx.fillRect(arena.x, z.centerPos - BAND_HALF_WIDTH, arena.w, BAND_HALF_WIDTH * 2);
  }

  ctx.globalAlpha = alpha * 0.80;
  ctx.strokeStyle = "#aaaaaa";
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

// 사슬 링크 — 라운드캡 선분 교대 배치 (가로/세로 타원형 고리 느낌)
// 뻗어나간 segStart~segEnd 구간만 그린다. 단일 stroke() 1회.
function drawChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const isVert  = z.orientation === "vertical";
  const fullLen = isVert ? arena.h : arena.w;
  const base    = isVert ? arena.y : arena.x;

  const segStart = z.direction === 1 ? base : base + fullLen - z.drawLength;
  const segEnd   = segStart + z.drawLength;

  const SPACING  = 10;  // 링크 중심 간격
  const HL       = 4;   // 링크 절반 길이 (타원 장축)
  const HW       = 1.5; // 링크 절반 굵기 (lineWidth)

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#c8c8c8";
  ctx.lineWidth   = HW * 2;
  ctx.lineCap     = "round";

  ctx.beginPath();
  let idx = 0;
  for (let pos = segStart; pos <= segEnd; pos += SPACING) {
    if (isVert) {
      if (idx % 2 === 0) {
        // 가로 타원 링크 (세로 체인의 짝수)
        ctx.moveTo(z.centerPos - HL, pos);
        ctx.lineTo(z.centerPos + HL, pos);
      } else {
        // 세로 타원 링크 (세로 체인의 홀수)
        ctx.moveTo(z.centerPos, pos - HL);
        ctx.lineTo(z.centerPos, pos + HL);
      }
    } else {
      if (idx % 2 === 0) {
        // 세로 타원 링크 (가로 체인의 짝수)
        ctx.moveTo(pos, z.centerPos - HL);
        ctx.lineTo(pos, z.centerPos + HL);
      } else {
        // 가로 타원 링크 (가로 체인의 홀수)
        ctx.moveTo(pos - HL, z.centerPos);
        ctx.lineTo(pos + HL, z.centerPos);
      }
    }
    idx++;
  }
  ctx.stroke(); // 전체 단 1회
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

    } else { // chain — 띠 없이 링크만, 끝에서 fade-out
      const fadeStart = EXTEND_DURATION + HOLD_DURATION;
      const alpha = z.elapsed > fadeStart
        ? Math.max(0, 1 - (z.elapsed - fadeStart) / FADE_DURATION)
        : 1.0;
      if (z.drawLength > 0) drawChainLinks(ctx, z, arena, alpha);
    }

    ctx.restore();
  }
}
