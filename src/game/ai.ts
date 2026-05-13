import type { Arena } from "./arena";
import type { Item } from "./item";
import type { Player } from "./player";
import { zones } from "./warning/state";
import {
  BAND_HALF_WIDTH,
  CHAIN_CONFIGS,
  LINK_R,
  getPhaseCycleVisual,
  type Zone,
} from "./warning/shared";

interface DangerInfo {
  score: number;
  awayX: number;
  awayY: number;
}

export interface ArenaAi {
  observeTimer: number;
  observeDelay: number;
  moveX: number;
  moveY: number;
  useTimer: number;
  useDelay: number;
  mistakeTimer: number;
  mistakeX: number;
  mistakeY: number;
  lastHasChain: boolean;
  driftAngle: number;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len <= 0.0001) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; nx: number; ny: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) {
    const away = normalize(px - ax, py - ay);
    return { dist: Math.hypot(px - ax, py - ay), nx: away.x, ny: away.y };
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  const away = normalize(px - cx, py - cy);
  return { dist: Math.hypot(px - cx, py - cy), nx: away.x, ny: away.y };
}

function createNoDanger(): DangerInfo {
  return { score: 0, awayX: 0, awayY: 0 };
}

function accumulateDanger(best: DangerInfo, dist: number, nx: number, ny: number, radius: number, urgency: number): DangerInfo {
  if (dist >= radius) return best;
  const closeness = 1 - dist / radius;
  const score = closeness * urgency;
  if (score <= best.score) return best;
  return { score, awayX: nx, awayY: ny };
}

function getStraightBounds(z: Zone, arena: Arena): { start: number; end: number } {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const linkR = cfg.linkRadius ?? LINK_R;
  const fullLen = z.orientation === "vertical" ? arena.h : arena.w;
  const base = z.orientation === "vertical" ? arena.y : arena.x;
  const adjBase = base + linkR;
  const adjMax = base + fullLen - linkR;

  if (z.phase === "extending") {
    const start = z.direction === 1 ? adjBase : adjMax - z.drawLength;
    return { start, end: start + z.drawLength };
  }

  if (z.phase === "active") {
    return { start: adjBase, end: adjMax };
  }

  if (z.direction === 1) {
    return { start: adjBase + z.exitOffset, end: adjMax };
  }
  return { start: adjBase, end: adjMax - z.exitOffset };
}

function getTurnDanger(px: number, py: number, z: Zone, arena: Arena): DangerInfo {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const fullLen = z.orientation === "vertical" ? arena.h : arena.w;
  const base = z.orientation === "vertical" ? arena.y : arena.x;
  const adjBase = base + LINK_R;
  const adjFullLen = fullLen - 2 * LINK_R;
  const seg1Origin = z.direction === 1 ? adjBase : adjBase + adjFullLen;
  const drawn1 = z.phase === "extending" ? Math.min(z.drawLength, z.seg1Len) : z.seg1Len;
  const drawn2 = z.phase === "extending" ? Math.max(0, z.drawLength - z.seg1Len) : z.seg2Len;
  const dangerRadius = (cfg.linkRadius ?? LINK_R) + 76;

  let best = createNoDanger();
  if (drawn1 > 0) {
    const ax = z.orientation === "vertical" ? z.centerPos : seg1Origin;
    const ay = z.orientation === "vertical" ? seg1Origin : z.centerPos;
    const bx = z.orientation === "vertical" ? z.centerPos : seg1Origin + z.direction * drawn1;
    const by = z.orientation === "vertical" ? seg1Origin + z.direction * drawn1 : z.centerPos;
    const hit = pointToSegmentDistance(px, py, ax, ay, bx, by);
    best = accumulateDanger(best, hit.dist, hit.nx, hit.ny, dangerRadius, 1.2);
  }

  if (drawn2 > 0) {
    const ax = z.orientation === "vertical" ? z.centerPos : z.turnPoint;
    const ay = z.orientation === "vertical" ? z.turnPoint : z.centerPos;
    const bx = z.orientation === "vertical" ? z.centerPos + z.turnDir * drawn2 : z.turnPoint;
    const by = z.orientation === "vertical" ? z.turnPoint : z.centerPos + z.turnDir * drawn2;
    const hit = pointToSegmentDistance(px, py, ax, ay, bx, by);
    best = accumulateDanger(best, hit.dist, hit.nx, hit.ny, dangerRadius, 1.15);
  }

  return best;
}

function getTrackingDanger(px: number, py: number, z: Zone): DangerInfo {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const radius = (cfg.chainWidth ?? 16) * 0.5 + 84;
  let best = createNoDanger();
  for (let i = 1; i < z.trackPoints.length; i++) {
    const a = z.trackPoints[i - 1];
    const b = z.trackPoints[i];
    const hit = pointToSegmentDistance(px, py, a.x, a.y, b.x, b.y);
    best = accumulateDanger(best, hit.dist, hit.nx, hit.ny, radius, 1.05);
  }
  return best;
}

function getZoneDanger(player: Player, arena: Arena, z: Zone): DangerInfo {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const px = player.x;
  const py = player.y;

  if (z.phase === "warning" || z.phase === "flash") {
    const isVert = z.orientation === "vertical";
    const pos = z.chainType === "fake" ? z.fakePos : z.centerPos;
    const bandHalf = (cfg.bandHalfWidth ?? BAND_HALF_WIDTH) + player.radius + 22;
    if (isVert) {
      const dist = Math.abs(px - pos);
      const away = normalize(px - pos, 0);
      return accumulateDanger(createNoDanger(), dist, away.x, away.y, bandHalf + 48, z.chainType === "fake" ? 0.65 : 0.95);
    }
    const dist = Math.abs(py - pos);
    const away = normalize(0, py - pos);
    return accumulateDanger(createNoDanger(), dist, away.x, away.y, bandHalf + 48, z.chainType === "fake" ? 0.65 : 0.95);
  }

  if (z.chainType === "phase" && !getPhaseCycleVisual(z.elapsed, cfg).solid) {
    return createNoDanger();
  }

  if (z.chainType === "tracking") {
    return getTrackingDanger(px, py, z);
  }

  if (z.chainType === "turn") {
    return getTurnDanger(px, py, z, arena);
  }

  const { start, end } = getStraightBounds(z, arena);
  const linkR = cfg.linkRadius ?? LINK_R;
  const dangerRadius = linkR + player.radius + (z.chainType === "giant" ? 40 : 64);

  let hit;
  if (z.orientation === "vertical") {
    hit = pointToSegmentDistance(px, py, z.centerPos, start, z.centerPos, end);
  } else {
    hit = pointToSegmentDistance(px, py, start, z.centerPos, end, z.centerPos);
  }
  return accumulateDanger(createNoDanger(), hit.dist, hit.nx, hit.ny, dangerRadius, z.phase === "active" ? 1.2 : 1.0);
}

function senseDanger(player: Player, arena: Arena): DangerInfo {
  let best = createNoDanger();
  for (const z of zones) {
    if (z.arenaIdx !== 1) continue;
    const danger = getZoneDanger(player, arena, z);
    if (danger.score > best.score) best = danger;
  }
  return best;
}

function chooseObservedMove(
  ai: ArenaAi,
  player: Player,
  enemy: Player,
  arena: Arena,
  item: Item,
): { x: number; y: number } {
  const danger = senseDanger(player, arena);
  if (danger.score > 0.18) {
    const tangentSign = Math.random() < 0.5 ? -1 : 1;
    const tangentX = -danger.awayY * tangentSign;
    const tangentY = danger.awayX * tangentSign;
    const escape = normalize(
      danger.awayX * (1.1 + danger.score) + tangentX * 0.45,
      danger.awayY * (1.1 + danger.score) + tangentY * 0.45,
    );
    return escape;
  }

  if (!player.hasChain && item.active) {
    const toItem = normalize(item.x - player.x, item.y - player.y);
    return normalize(
      toItem.x + Math.cos(ai.driftAngle) * 0.18,
      toItem.y + Math.sin(ai.driftAngle) * 0.18,
    );
  }

  const centerX = arena.x + arena.w * 0.5;
  const centerY = arena.y + arena.h * 0.5;
  const toCenter = normalize(centerX - player.x, centerY - player.y);
  const toEnemy = normalize(enemy.x - enemy.radius - centerX, enemy.y - centerY);
  return normalize(
    toCenter.x * 0.65 + toEnemy.x * 0.25 + Math.cos(ai.driftAngle) * 0.3,
    toCenter.y * 0.65 + toEnemy.y * 0.25 + Math.sin(ai.driftAngle) * 0.3,
  );
}

export function createArenaAi(): ArenaAi {
  return {
    observeTimer: 0,
    observeDelay: randRange(0.2, 0.4),
    moveX: 0,
    moveY: 0,
    useTimer: 0,
    useDelay: randRange(0.75, 1.45),
    mistakeTimer: randRange(1.0, 2.2),
    mistakeX: 0,
    mistakeY: 0,
    lastHasChain: false,
    driftAngle: randRange(0, Math.PI * 2),
  };
}

export function resetArenaAi(ai: ArenaAi): void {
  ai.observeTimer = 0;
  ai.observeDelay = randRange(0.2, 0.4);
  ai.moveX = 0;
  ai.moveY = 0;
  ai.useTimer = 0;
  ai.useDelay = randRange(0.75, 1.45);
  ai.mistakeTimer = randRange(1.0, 2.2);
  ai.mistakeX = 0;
  ai.mistakeY = 0;
  ai.lastHasChain = false;
  ai.driftAngle = randRange(0, Math.PI * 2);
}

export function updateArenaAi(
  ai: ArenaAi,
  dt: number,
  player: Player,
  enemy: Player,
  arena: Arena,
  item: Item,
): boolean {
  ai.observeTimer -= dt;
  ai.mistakeTimer -= dt;
  ai.driftAngle += dt * 0.9;

  if (ai.mistakeTimer <= 0) {
    ai.mistakeTimer = randRange(1.3, 3.2);
    const angle = randRange(0, Math.PI * 2);
    ai.mistakeX = Math.cos(angle);
    ai.mistakeY = Math.sin(angle);
  }

  if (ai.observeTimer <= 0) {
    const nextMove = chooseObservedMove(ai, player, enemy, arena, item);
    ai.moveX = nextMove.x;
    ai.moveY = nextMove.y;
    ai.observeDelay = randRange(0.2, 0.4);
    ai.observeTimer = ai.observeDelay;
  }

  let moveX = ai.moveX;
  let moveY = ai.moveY;
  if (Math.random() < 0.02) {
    moveX *= 0.2;
    moveY *= 0.2;
  } else if (Math.random() < 0.08) {
    moveX += ai.mistakeX * 0.55;
    moveY += ai.mistakeY * 0.55;
    const corrected = normalize(moveX, moveY);
    moveX = corrected.x;
    moveY = corrected.y;
  }

  const dist = player.speed * 0.88 * dt;
  player.x += moveX * dist;
  player.y += moveY * dist;
  player.x = Math.max(arena.x + player.radius, Math.min(arena.x + arena.w - player.radius, player.x));
  player.y = Math.max(arena.y + player.radius, Math.min(arena.y + arena.h - player.radius, player.y));

  if (player.hasChain && !ai.lastHasChain) {
    ai.useTimer = 0;
    ai.useDelay = randRange(0.8, 1.6);
  }
  ai.lastHasChain = player.hasChain;

  if (!player.hasChain) return false;

  ai.useTimer += dt;
  if (ai.useTimer < ai.useDelay) return false;
  if (Math.random() < 0.12) {
    ai.useTimer = 0;
    ai.useDelay = randRange(0.8, 1.6);
    ai.lastHasChain = false;
    return true;
  }
  return false;
}
