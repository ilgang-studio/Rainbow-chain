import type { Arena } from "./arena";

export type Orientation = "horizontal" | "vertical";
type Phase = "warning" | "flash" | "extending" | "active" | "exiting";

// ── 체인 타입 설정 ─────────────────────────────────────────────────────────────
// 새 체인 타입 추가 시 여기에만 항목을 추가하면 됩니다.
export interface ChainConfig {
  extendDuration:   number;  // 뻗는 데 걸리는 시간 (초)
  activeDuration:   number;  // 완전히 뻗은 뒤 유지 시간 (초)
  exitDuration:     number;  // 아레나 밖으로 나가는 시간 (초)
  warningColor:     string;  // 경고 띠/중앙선 색상
  linkColor:        string;  // 체인 링크 + glow 색상
  warningDuration?: number;  // 경고 단계 지속 시간 (미지정 시 WARNING_DURATION)
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
    extendDuration: 0.22,
    activeDuration: 0.7,
    exitDuration:   0.22,
    warningColor:   "#ff2200",
    linkColor:      "#ff5533",
  },
  turn: {
    extendDuration: 0.55,   // 두 선분을 합산하므로 약간 느림
    activeDuration: 1.6,
    exitDuration:   0.55,
    warningColor:   "#ffcc00",
    linkColor:      "#ffee44",
  },
  fake: {
    extendDuration:  0.55,
    activeDuration:  1.8,
    exitDuration:    0.45,
    warningColor:    "#cc44ff",
    linkColor:       "#dd77ff",
    warningDuration: 2.6,   // 노말보다 길어서 플레이어가 충분히 속음
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
  chainType:   string;   // CHAIN_CONFIGS 키
  fakePos:     number;   // fake 체인: 경고 표시 위치 (다른 타입에선 centerPos와 동일)
  turnDir:     1 | -1;   // turn 체인 꺾임 방향 (다른 타입에선 무시)
  turnPoint:   number;   // turn 체인: 꺾이는 canvas 좌표 (primary axis)
  seg1Len:     number;   // turn 체인: 1구간 길이 (px)
  seg2Len:     number;   // turn 체인: 2구간 길이 (px)
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
  let centerPos = orientation === "vertical"
    ? arena.x + pad + Math.random() * (arena.w - pad * 2)
    : arena.y + pad + Math.random() * (arena.h - pad * 2);
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const turnDir:  1 | -1 = Math.random() < 0.5 ? 1 : -1;

  // Turn 체인 전용: 꺾임 지점 + 구간 길이 계산
  const isVert     = orientation === "vertical";

  // Fake 체인: fakePos = 경고 위치, centerPos = 아레나 반대편 실제 체인 위치
  const fakePos = centerPos;
  if (chainType === "fake") {
    const axisCenter = isVert ? arena.x + arena.w / 2 : arena.y + arena.h / 2;
    centerPos = 2 * axisCenter - centerPos;
  }
  const fullLen    = isVert ? arena.h : arena.w;
  const base       = isVert ? arena.y : arena.x;
  const adjBase    = base + LINK_R;
  const adjFullLen = fullLen - 2 * LINK_R;
  const turnRatio  = 0.4 + Math.random() * 0.2;  // 40~60% 지점에서 꺾임

  let turnPoint: number;
  let seg1Len:   number;
  let seg2Len:   number;

  if (chainType === "turn") {
    if (direction === 1) {
      turnPoint = adjBase + adjFullLen * turnRatio;
      seg1Len   = turnPoint - adjBase;
    } else {
      turnPoint = adjBase + adjFullLen * (1 - turnRatio);
      seg1Len   = adjBase + adjFullLen - turnPoint;
    }
    seg2Len = isVert
      ? (turnDir === 1 ? (arena.x + arena.w - LINK_R) - centerPos : centerPos - (arena.x + LINK_R))
      : (turnDir === 1 ? (arena.y + arena.h - LINK_R) - centerPos : centerPos - (arena.y + LINK_R));
  } else {
    turnPoint = 0;
    seg1Len   = 0;
    seg2Len   = 0;
  }

  zones.push({
    orientation, centerPos, arenaIdx,
    phase: "warning", elapsed: 0,
    direction, drawLength: 0, exitOffset: 0,
    chainType, fakePos, turnDir, turnPoint, seg1Len, seg2Len,
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
    for (let n = 0; n < toSpawn; n++) {
      const t = CHAIN_TYPE_IDS[Math.floor(Math.random() * CHAIN_TYPE_IDS.length)];
      spawnZone(i as 0 | 1, arenas[i], t);
    }
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.elapsed += dt;

    if (z.phase === "warning") {
      const wDur = (CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"]).warningDuration ?? WARNING_DURATION;
      if (z.elapsed >= wDur) { z.phase = "flash"; z.elapsed = 0; }

    } else if (z.phase === "flash") {
      if (z.elapsed >= FLASH_DURATION) { z.phase = "extending"; z.elapsed = 0; z.drawLength = 0; }

    } else if (z.phase === "extending") {
      const cfg    = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
      const arena  = arenas[z.arenaIdx];
      const maxLen = z.chainType === "turn"
        ? z.seg1Len + z.seg2Len
        : (z.orientation === "vertical" ? arena.h : arena.w) - 2 * LINK_R;
      z.drawLength = Math.min(maxLen, maxLen * (z.elapsed / cfg.extendDuration));
      if (z.elapsed >= cfg.extendDuration) {
        z.phase = "active"; z.elapsed = 0; z.drawLength = maxLen;
      }

    } else if (z.phase === "active") {
      const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
      if (z.elapsed >= cfg.activeDuration) { z.phase = "exiting"; z.elapsed = 0; z.exitOffset = 0; }

    } else { // exiting
      const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
      if (z.chainType === "turn") {
        if (z.elapsed >= cfg.exitDuration) zones.splice(i, 1);
      } else {
        const arena      = arenas[z.arenaIdx];
        const fullLen    = z.orientation === "vertical" ? arena.h : arena.w;
        const adjFullLen = fullLen - 2 * LINK_R;
        z.exitOffset     = adjFullLen * (z.elapsed / cfg.exitDuration);
        if (z.exitOffset >= adjFullLen) zones.splice(i, 1);
      }
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

// Turn 체인 경고 단계: 꺾일 방향 화살표
function drawTurnArrow(ctx: CanvasRenderingContext2D, z: Zone, alpha: number): void {
  const isVert = z.orientation === "vertical";
  const cfg    = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];

  const ax = isVert ? z.centerPos : z.turnPoint;
  const ay = isVert ? z.turnPoint : z.centerPos;

  // 화살표가 가리키는 방향 (2차 축)
  const dx = isVert ? z.turnDir : 0;
  const dy = isVert ? 0 : z.turnDir;

  const TIP  = 9;
  const BACK = 3;
  const HALF = 6;

  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle   = cfg.warningColor;
  ctx.beginPath();
  ctx.moveTo(ax + dx * TIP,                    ay + dy * TIP);
  ctx.lineTo(ax - dx * BACK - dy * HALF,       ay - dy * BACK + dx * HALF);
  ctx.lineTo(ax - dx * BACK + dy * HALF,       ay - dy * BACK - dx * HALF);
  ctx.closePath();
  ctx.fill();
}

// Fake 체인 경고 띠 — fakePos 위치에 보라색 + glitch 효과
function drawFakeWarning(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena, alpha: number): void {
  const cfg    = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
  const isVert = z.orientation === "vertical";
  const pos    = z.fakePos;

  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle   = cfg.warningColor;
  if (isVert) ctx.fillRect(pos - BAND_HALF_WIDTH, arena.y, BAND_HALF_WIDTH * 2, arena.h);
  else        ctx.fillRect(arena.x, pos - BAND_HALF_WIDTH, arena.w, BAND_HALF_WIDTH * 2);

  // 중앙선 — 구간마다 랜덤 흔들림으로 glitch 표현
  ctx.globalAlpha = alpha * 0.80;
  ctx.strokeStyle = cfg.warningColor;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  const SEG = 18;
  if (isVert) {
    for (let y = arena.y; y < arena.y + arena.h; y += SEG) {
      const gx = pos + (Math.random() < 0.3 ? (Math.random() - 0.5) * 7 : 0);
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, Math.min(y + SEG, arena.y + arena.h));
    }
  } else {
    for (let x = arena.x; x < arena.x + arena.w; x += SEG) {
      const gy = pos + (Math.random() < 0.3 ? (Math.random() - 0.5) * 7 : 0);
      ctx.moveTo(x, gy);
      ctx.lineTo(Math.min(x + SEG, arena.x + arena.w), gy);
    }
  }
  ctx.stroke();

  // 추가 glitch 잔상 — 짧은 랜덤 선 3개
  ctx.globalAlpha = alpha * 0.30;
  ctx.lineWidth   = 1;
  for (let i = 0; i < 3; i++) {
    const off = (Math.random() - 0.5) * BAND_HALF_WIDTH * 1.5;
    ctx.beginPath();
    if (isVert) {
      const y1 = arena.y + Math.random() * arena.h;
      ctx.moveTo(pos + off, y1);
      ctx.lineTo(pos + off, y1 + Math.random() * 28 + 6);
    } else {
      const x1 = arena.x + Math.random() * arena.w;
      ctx.moveTo(x1, pos + off);
      ctx.lineTo(x1 + Math.random() * 28 + 6, pos + off);
    }
    ctx.stroke();
  }
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

// Turn 체인 L자형 링크 렌더링 (glow + -o-o-o- 두 구간)
function drawTurnChainLinks(ctx: CanvasRenderingContext2D, z: Zone, arena: Arena): void {
  const cfg    = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"];
  const isVert = z.orientation === "vertical";
  const fullLen    = isVert ? arena.h : arena.w;
  const base       = isVert ? arena.y : arena.x;
  const adjBase    = base + LINK_R;
  const adjFullLen = fullLen - 2 * LINK_R;

  const drawn1 = Math.min(z.drawLength, z.seg1Len);
  const drawn2 = Math.max(0, z.drawLength - z.seg1Len);

  let exitAlpha = 1.0;
  if (z.phase === "exiting") {
    exitAlpha = Math.max(0, 1 - z.elapsed / cfg.exitDuration);
  }

  // Seg1 시작점 (primary axis 상의 진입 좌표)
  const seg1Origin = z.direction === 1 ? adjBase : adjBase + adjFullLen;

  const STEP = 13;

  // glow pass — 두 세그먼트
  ctx.globalAlpha = 0.18 * exitAlpha;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth   = LINK_R * 4;
  ctx.lineCap     = "round";
  ctx.beginPath();
  if (drawn1 > 0) {
    if (isVert) {
      ctx.moveTo(z.centerPos, seg1Origin);
      ctx.lineTo(z.centerPos, seg1Origin + z.direction * drawn1);
    } else {
      ctx.moveTo(seg1Origin, z.centerPos);
      ctx.lineTo(seg1Origin + z.direction * drawn1, z.centerPos);
    }
  }
  if (drawn2 > 0) {
    if (isVert) {
      ctx.moveTo(z.centerPos, z.turnPoint);
      ctx.lineTo(z.centerPos + z.turnDir * drawn2, z.turnPoint);
    } else {
      ctx.moveTo(z.turnPoint, z.centerPos);
      ctx.lineTo(z.turnPoint, z.centerPos + z.turnDir * drawn2);
    }
  }
  ctx.stroke();

  // main pass — -o-o-o- 링크
  ctx.globalAlpha = exitAlpha;
  ctx.strokeStyle = cfg.linkColor;
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = "butt";
  ctx.beginPath();

  // Seg1 링크
  if (drawn1 > 0) {
    let prevD: number | null = null;
    for (let d = 0; d <= drawn1; d += STEP) {
      const cx = isVert ? z.centerPos : seg1Origin + z.direction * d;
      const cy = isVert ? seg1Origin + z.direction * d : z.centerPos;
      if (prevD !== null) {
        const px = isVert ? z.centerPos : seg1Origin + z.direction * (prevD + LINK_R);
        const py = isVert ? seg1Origin + z.direction * (prevD + LINK_R) : z.centerPos;
        const nx = isVert ? z.centerPos : seg1Origin + z.direction * (d - LINK_R);
        const ny = isVert ? seg1Origin + z.direction * (d - LINK_R) : z.centerPos;
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
      }
      ctx.moveTo(cx + LINK_R, cy);
      ctx.arc(cx, cy, LINK_R, 0, Math.PI * 2);
      prevD = d;
    }
  }

  // Seg2 링크 (perpendicular)
  if (drawn2 > 0) {
    let prevD: number | null = null;
    for (let d = 0; d <= drawn2; d += STEP) {
      const cx = isVert ? z.centerPos + z.turnDir * d : z.turnPoint;
      const cy = isVert ? z.turnPoint : z.centerPos + z.turnDir * d;
      if (prevD !== null) {
        const px = isVert ? z.centerPos + z.turnDir * (prevD + LINK_R) : z.turnPoint;
        const py = isVert ? z.turnPoint : z.centerPos + z.turnDir * (prevD + LINK_R);
        const nx = isVert ? z.centerPos + z.turnDir * (d - LINK_R) : z.turnPoint;
        const ny = isVert ? z.turnPoint : z.centerPos + z.turnDir * (d - LINK_R);
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
      }
      ctx.moveTo(cx + LINK_R, cy);
      ctx.arc(cx, cy, LINK_R, 0, Math.PI * 2);
      prevD = d;
    }
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
      const wDur = (CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS["normal"]).warningDuration ?? WARNING_DURATION;
      const a    = z.elapsed / wDur;
      if (z.chainType === "fake") drawFakeWarning(ctx, z, arena, a);
      else drawBand(ctx, z, arena, a);
      if (z.chainType === "turn") drawTurnArrow(ctx, z, a);

    } else if (z.phase === "flash") {
      const pulse = 0.5 + 0.5 * Math.sin((z.elapsed / FLASH_DURATION) * Math.PI * 10);
      if (z.chainType === "fake") drawFakeWarning(ctx, z, arena, pulse);
      else drawBand(ctx, z, arena, pulse);
      if (z.chainType === "turn") drawTurnArrow(ctx, z, pulse);

    } else { // extending / active / exiting
      if (z.chainType === "turn") {
        drawTurnChainLinks(ctx, z, arena);
      } else {
        drawChainLinks(ctx, z, arena);
      }
    }

    ctx.restore();
  }
}
