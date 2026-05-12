import type { Arena } from "./arena";

export type Orientation = "horizontal" | "vertical";
type Phase = "warning" | "flash" | "extending" | "active" | "exiting";

// ── 체인 타입 설정 ─────────────────────────────────────────────────────────────
// 새 체인 타입 추가 시 여기에만 항목을 추가하면 됩니다.
export interface ChainConfig {
  extendDuration: number;  // 뻗는 데 걸리는 시간 (초)
  activeDuration: number;  // 완전히 뻗은 뒤 유지 시간 (초)
  exitDuration:   number;  // 아레나 밖으로 나가는 시간 (초)
  warningColor:   string;  // 경고 띠/중앙선 색상
  linkColor:      string;  // 체인 링크 + glow 색상
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  normal: {
    extendDuration: 0.45,
    activeDuration: 1.8,
    exitDuration:   0.45,
    warningColor:   "#999999",
    linkColor:      "#c8c8c8",
  },
  rush: {
    extendDuration: 0.22,   // normal 대비 2배 빠름
    activeDuration: 0.7,    // 짧은 유지 시간
    exitDuration:   0.22,
    warningColor:   "#ff2200",
    linkColor:      "#ff5533",
  },
};

// 아이템 획득 시 랜덤 지급에 사용
export const CHAIN_TYPE_IDS = Object.keys(CHAIN_CONFIGS);

export interface Zone {
  orientation: Orientation;
  centerPos:   number;
  arenaIdx:    0 | 1;
  phase:       Phase;
  elapsed:     number;
  direction:   1 | -1;
  drawLength:  number;
  exitOffset:  number;
  chainType:   string;  // CHAIN_CONFIGS 키 ("normal" | "rush" | ...)
}

const WARNING_DURATION    = 1.8;
const FLASH_DURATION      = 0.5;
const SPAWN_INTERVAL      = 4.0;
const BAND_HALF_WIDTH     = 24;
const MAX_ZONES_PER_ARENA = 6;
const LINK_R              = 3;

const zones: Zone[] = [];
const spawnTimers: [number, number] = [1.2, SPAWN_INTERVAL * 0.5 + 0.9];

const _chainBuf: Zone[] = [];
export function getActiveChains(): Zone[] {
  _chainBuf.length = 0;
  for (let i = 0; i < zones.length; i++) {
    const ph = zones[i].phase;
    if (ph === "extending" || ph === "active" || ph === "exiting") {
      _chainBuf.push(zones[i]);
    }
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

function spawnZone(arenaIdx: 0 | 1, arena: Arena, chainType = "normal"): void {
  const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
  const pad = Math.min(arena.w, arena.h) * 0.15;
  const centerPos = orientation === "vertical"
    ? arena.x + pad + Math.random() * (arena.w - pad * 2)
    : arena.y + pad + Math.random() * (arena.h - pad * 2);
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  zones.push({
    orientation, centerPos, arenaIdx,
    phase: "warning", elapsed: 0,
    direction, drawLength: 0, exitOffset: 0,
    chainType,
  });
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
      if (z.elapsed >= FLASH_DURATION) { z.phase = "extending"; z.elapsed = 0; z.drawLength = 0; }

    } else if (z.phase === "extending") {
      const cfg        = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
      const arena      = arenas[z.arenaIdx];
      const fullLen    = z.orientation === "vertical" ? arena.h : arena.w;
      const adjFullLen = fullLen - 2 * LINK_R;
      z.drawLength     = Math.min(adjFullLen, adjFullLen * (z.elapsed / cfg.extendDuration));
      if (z.elapsed >= cfg.extendDuration) {
        z.phase = "active"; z.elapsed = 0; z.drawLength = adjFullLen;
      }

    } else if (z.phase === "active") {
      const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
      if (z.elapsed >= cfg.activeDuration) { z.phase = "exiting"; z.elapsed = 0; z.exitOffset = 0; }

    } else { // exiting
      const cfg        = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
      const arena      = arenas[z.arenaIdx];
      const fullLen    = z.orientation === "vertical" ? arena.h : arena.w;
      const adjFullLen = fullLen - 2 * LINK_R;
      z.exitOffset     = adjFullLen * (z.elapsed / cfg.exitDuration);
      if (z.exitOffset >= adjFullLen) zones.splice(i, 1);
    }
  }
}

export function fireChain(arenaIdx: 0 | 1, arenas: [Arena, Arena], chainType: string): void {
  spawnZone(arenaIdx, arenas[arenaIdx], chainType);
}

// ── 내부 렌더 헬퍼 ───────────────────────────────────────────────────────────

// 경고 띠 + 중앙선 (warning / flash 단계) — 색상은 체인 타입별 config
function drawBand(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const cfg    = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
  const isVert = z.orientation === "vertical";

  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle   = cfg.warningColor;
  if (isVert) {
    ctx.fillRect(z.centerPos - BAND_HALF_WIDTH, arena.y, BAND_HALF_WIDTH * 2, arena.h);
  } else {
    ctx.fillRect(arena.x, z.centerPos - BAND_HALF_WIDTH, arena.w, BAND_HALF_WIDTH * 2);
  }

  ctx.globalAlpha = alpha * 0.80;
  ctx.strokeStyle = cfg.warningColor;
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

// 사슬 링크 — -o-o-o- 형태: 원형 링크 + 연결선, 단일 stroke()
// 시작/끝을 adjBase/adjMax (아레나 내부) 기준으로 계산; clip은 호출부에서 처리
function drawChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena): void {
  const isVert     = z.orientation === "vertical";
  const fullLen    = isVert ? arena.h : arena.w;
  const base       = isVert ? arena.y : arena.x;
  const adjBase    = base + LINK_R;          // 아레나 시작 + 링크 반지름
  const adjFullLen = fullLen - 2 * LINK_R;  // 실제 체인 가동 범위

  let chainStart: number;
  let chainLen:   number;

  if (z.phase === "extending") {
    chainLen   = z.drawLength;
    chainStart = z.direction === 1 ? adjBase : adjBase + adjFullLen - chainLen;
  } else if (z.phase === "active") {
    chainLen   = adjFullLen;
    chainStart = adjBase;
  } else { // exiting — clip이 아레나 경계 처리
    chainLen   = adjFullLen;
    chainStart = z.direction === 1 ? adjBase + z.exitOffset : adjBase - z.exitOffset;
  }

  if (chainLen <= 0) return;

  const STEP = 13;  // 링크 중심 간격 (line = STEP - LINK_R*2 = 7px)

  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];

  // glow pass — 체인 경로를 굵은 반투명 선으로 1회만 그림 (shadowBlur 없음)
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth   = LINK_R * 4;
  ctx.lineCap     = "round";
  ctx.beginPath();
  if (isVert) {
    ctx.moveTo(z.centerPos, chainStart);
    ctx.lineTo(z.centerPos, chainStart + chainLen);
  } else {
    ctx.moveTo(chainStart, z.centerPos);
    ctx.lineTo(chainStart + chainLen, z.centerPos);
  }
  ctx.stroke();

  // main pass — 실제 고리 선명하게 렌더링
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = "butt";

  ctx.beginPath();
  let prevPos: number | null = null;
  for (let pos = chainStart; pos <= chainStart + chainLen; pos += STEP) {
    const cx = isVert ? z.centerPos : pos;
    const cy = isVert ? pos : z.centerPos;

    // 이전 원 끝 → 현재 원 시작 연결선
    if (prevPos !== null) {
      if (isVert) {
        ctx.moveTo(z.centerPos, prevPos + LINK_R);
        ctx.lineTo(z.centerPos, cy - LINK_R);
      } else {
        ctx.moveTo(prevPos + LINK_R, z.centerPos);
        ctx.lineTo(cx - LINK_R, z.centerPos);
      }
    }

    // 원형 링크
    ctx.moveTo(cx + LINK_R, cy);
    ctx.arc(cx, cy, LINK_R, 0, Math.PI * 2);

    prevPos = pos;
  }
  ctx.stroke();
}

// ── 메인 렌더 ────────────────────────────────────────────────────────────────
export function drawWarnings(ctx: CanvasRenderingContext2D, arenas: [Arena, Arena]): void {
  ctx.shadowBlur = 0;

  for (const z of zones) {
    const arena = arenas[z.arenaIdx];
    ctx.save();

    // 모든 단계에 아레나 clip 적용 — 링크/glow가 테두리 밖으로 나가지 않음
    ctx.beginPath();
    ctx.rect(arena.x, arena.y, arena.w, arena.h);
    ctx.clip();

    if (z.phase === "warning") {
      drawBand(ctx, z, arena, z.elapsed / WARNING_DURATION);

    } else if (z.phase === "flash") {
      const pulse = 0.5 + 0.5 * Math.sin((z.elapsed / FLASH_DURATION) * Math.PI * 10);
      drawBand(ctx, z, arena, pulse);

    } else { // extending / active / exiting
      drawChainLinks(ctx, z, arena);
    }

    ctx.restore();
  }
}
