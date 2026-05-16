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

interface BodyPoint {
  x: number;
  y: number;
  radius: number;
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

function getWallClearance(player: BodyPoint, arena: Arena): number {
  return Math.min(
    player.x - (arena.x + player.radius),
    arena.x + arena.w - player.radius - player.x,
    player.y - (arena.y + player.radius),
    arena.y + arena.h - player.radius - player.y,
  );
}

function addDanger(sum: DangerInfo, danger: DangerInfo): DangerInfo {
  if (danger.score <= 0) return sum;
  sum.score += danger.score;
  sum.awayX += danger.awayX * danger.score;
  sum.awayY += danger.awayY * danger.score;
  return sum;
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

function getZoneDanger(player: BodyPoint, arena: Arena, z: Zone): DangerInfo {
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

function getWallDanger(player: BodyPoint, arena: Arena): DangerInfo {
  const pad = 74;
  const danger = createNoDanger();
  addDanger(
    danger,
    accumulateDanger(createNoDanger(), player.x - arena.x, 1, 0, pad + player.radius, 0.52),
  );
  addDanger(
    danger,
    accumulateDanger(createNoDanger(), arena.x + arena.w - player.x, -1, 0, pad + player.radius, 0.52),
  );
  addDanger(
    danger,
    accumulateDanger(createNoDanger(), player.y - arena.y, 0, 1, pad + player.radius, 0.44),
  );
  addDanger(
    danger,
    accumulateDanger(createNoDanger(), arena.y + arena.h - player.y, 0, -1, pad + player.radius, 0.44),
  );
  return danger;
}

function senseDanger(player: BodyPoint, arena: Arena, arenaIdx = 1): DangerInfo {
  const total = createNoDanger();
  for (const z of zones) {
    if (z.arenaIdx !== arenaIdx) continue;
    const danger = getZoneDanger(player, arena, z);
    addDanger(total, danger);
  }

  addDanger(total, getWallDanger(player, arena));

  if (total.score <= 0.0001) return createNoDanger();
  const away = normalize(total.awayX, total.awayY);
  return {
    score: total.score,
    awayX: away.x,
    awayY: away.y,
  };
}

function clampToArena(point: BodyPoint, arena: Arena): BodyPoint {
  return {
    x: Math.max(arena.x + point.radius, Math.min(arena.x + arena.w - point.radius, point.x)),
    y: Math.max(arena.y + point.radius, Math.min(arena.y + arena.h - point.radius, point.y)),
    radius: point.radius,
  };
}

function scoreCandidateMove(
  ai: ArenaAi,
  player: Player,
  enemy: Player,
  arena: Arena,
  arenaIdx: 0 | 1,
  item: Item,
  dirX: number,
  dirY: number,
): number {
  const move = normalize(dirX, dirY);
  const lookahead = [0.16, 0.32, 0.52, 0.8, 1.08];
  const weights = [1.6, 1.28, 1.0, 0.72, 0.48];
  let score = 0;
  let lastProjected = clampToArena({
    x: player.x + move.x * player.speed * 0.16,
    y: player.y + move.y * player.speed * 0.16,
    radius: player.radius,
  }, arena);

  for (let i = 0; i < lookahead.length; i++) {
    const t = lookahead[i];
    const projected = clampToArena({
      x: player.x + move.x * player.speed * 0.88 * t,
      y: player.y + move.y * player.speed * 0.88 * t,
      radius: player.radius,
    }, arena);
    const danger = senseDanger(projected, arena, arenaIdx);
    score -= danger.score * weights[i];
    const wallClearance = getWallClearance(projected, arena);
    score += Math.min(wallClearance, 118) * 0.0032 * weights[i];
    lastProjected = projected;
  }

  const centerX = arena.x + arena.w * 0.5;
  const centerY = arena.y + arena.h * 0.5;
  const centerDist = Math.hypot(player.x - centerX, player.y - centerY);
  const projectedCenterDist = Math.hypot(
    player.x + move.x * player.speed * 0.28 - centerX,
    player.y + move.y * player.speed * 0.28 - centerY,
  );
  score += (centerDist - projectedCenterDist) * 0.0024;

  if (!player.hasChain && item.active) {
    const itemDistNow = Math.hypot(item.x - player.x, item.y - player.y);
    const projectedItemDist = Math.hypot(item.x - lastProjected.x, item.y - lastProjected.y);
    score += (itemDistNow - projectedItemDist) * 0.015;

    const toItem = normalize(item.x - lastProjected.x, item.y - lastProjected.y);
    const pathProbe = clampToArena({
      x: lastProjected.x + toItem.x * 68,
      y: lastProjected.y + toItem.y * 68,
      radius: player.radius,
    }, arena);
    const pathDanger = senseDanger(pathProbe, arena, arenaIdx);
    score -= pathDanger.score * 0.42;
  } else {
    const shadowX = enemy.x - enemy.radius * 0.45;
    const shadowY = enemy.y;
    const enemyDistNow = Math.hypot(shadowX - player.x, shadowY - player.y);
    const enemyDistLater = Math.hypot(
      shadowX - (player.x + move.x * player.speed * 0.25),
      shadowY - (player.y + move.y * player.speed * 0.25),
    );
    score += (enemyDistNow - enemyDistLater) * 0.0016;
  }

  const continuity = normalize(ai.moveX, ai.moveY);
  score += (continuity.x * move.x + continuity.y * move.y) * 0.09;
  score += (Math.cos(ai.driftAngle) * move.x + Math.sin(ai.driftAngle) * move.y) * 0.06;
  score += randRange(-0.045, 0.045);
  return score;
}

function chooseObservedMove(
  ai: ArenaAi,
  player: Player,
  enemy: Player,
  arena: Arena,
  arenaIdx: 0 | 1,
  item: Item,
): { x: number; y: number } {
  const danger = senseDanger(player, arena, arenaIdx);
  const candidates: Array<{ x: number; y: number }> = [];

  if (danger.score > 0.12) {
    candidates.push({ x: danger.awayX, y: danger.awayY });
    candidates.push({ x: -danger.awayY, y: danger.awayX });
    candidates.push({ x: danger.awayY, y: -danger.awayX });
  }

  if (!player.hasChain && item.active) {
    const toItem = normalize(item.x - player.x, item.y - player.y);
    candidates.push(toItem);
    if (danger.score > 0.08) {
      candidates.push(normalize(toItem.x * 0.84 + danger.awayX * 0.42, toItem.y * 0.84 + danger.awayY * 0.42));
      candidates.push(normalize(toItem.x * 0.88 - danger.awayY * 0.32, toItem.y * 0.88 + danger.awayX * 0.32));
      candidates.push(normalize(toItem.x * 0.88 + danger.awayY * 0.32, toItem.y * 0.88 - danger.awayX * 0.32));
    }
  }

  const centerX = arena.x + arena.w * 0.5;
  const centerY = arena.y + arena.h * 0.5;
  candidates.push(normalize(centerX - player.x, centerY - player.y));
  candidates.push(normalize(enemy.x - player.x, enemy.y - player.y));
  candidates.push({ x: ai.moveX, y: ai.moveY });

  const slices = 16;
  for (let i = 0; i < slices; i++) {
    const angle = (Math.PI * 2 * i) / slices;
    candidates.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }

  let bestMove = normalize(centerX - player.x, centerY - player.y);
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const move = normalize(candidate.x, candidate.y);
    if (Math.abs(move.x) <= 0.0001 && Math.abs(move.y) <= 0.0001) continue;
    const score = scoreCandidateMove(ai, player, enemy, arena, arenaIdx, item, move.x, move.y);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

export function createArenaAi(): ArenaAi {
  return {
    observeTimer: 0,
    observeDelay: randRange(0.18, 0.34),
    moveX: 0,
    moveY: 0,
    useTimer: 0,
    useDelay: randRange(0.65, 1.2),
    mistakeTimer: randRange(1.0, 2.2),
    mistakeX: 0,
    mistakeY: 0,
    lastHasChain: false,
    driftAngle: randRange(0, Math.PI * 2),
  };
}

export function resetArenaAi(ai: ArenaAi): void {
  ai.observeTimer = 0;
  ai.observeDelay = randRange(0.18, 0.34);
  ai.moveX = 0;
  ai.moveY = 0;
  ai.useTimer = 0;
  ai.useDelay = randRange(0.65, 1.2);
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
  enemyArena: Arena,
  item: Item,
  arenaIdx: 0 | 1 = 1,
  enemyArenaIdx: 0 | 1 = 0,
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
    const currentDanger = senseDanger(player, arena, arenaIdx);
    const nextMove = chooseObservedMove(ai, player, enemy, arena, arenaIdx, item);
    const blended = normalize(ai.moveX * 0.28 + nextMove.x * 0.72, ai.moveY * 0.28 + nextMove.y * 0.72);
    ai.moveX = blended.x;
    ai.moveY = blended.y;
    ai.observeDelay = currentDanger.score > 0.72 ? randRange(0.16, 0.27) : randRange(0.2, 0.36);
    ai.observeTimer = ai.observeDelay;
  }

  let moveX = ai.moveX;
  let moveY = ai.moveY;
  if (Math.random() < 0.02) {
    moveX *= 0.2;
    moveY *= 0.2;
  } else if (Math.random() < 0.06) {
    moveX += ai.mistakeX * 0.42;
    moveY += ai.mistakeY * 0.42;
    const corrected = normalize(moveX, moveY);
    moveX = corrected.x;
    moveY = corrected.y;
  }

  const immediateDanger = senseDanger(player, arena, arenaIdx);
  const moveSpeedScale = immediateDanger.score > 0.85 ? 0.96 : 0.9;
  const dist = player.speed * moveSpeedScale * dt;
  player.x += moveX * dist;
  player.y += moveY * dist;
  player.x = Math.max(arena.x + player.radius, Math.min(arena.x + arena.w - player.radius, player.x));
  player.y = Math.max(arena.y + player.radius, Math.min(arena.y + arena.h - player.radius, player.y));

  if (player.hasChain && !ai.lastHasChain) {
    ai.useTimer = 0;
    ai.useDelay = randRange(0.6, 1.15);
  }
  ai.lastHasChain = player.hasChain;

  if (!player.hasChain) return false;

  ai.useTimer += dt;
  if (ai.useTimer < ai.useDelay) return false;
  const currentDanger = senseDanger(player, arena, 1);
  const enemyDanger = senseDanger(enemy, enemyArena, enemyArenaIdx);
  const enemyWallClearance = getWallClearance(enemy, enemyArena);
  const enemyNearWall = enemyWallClearance < 60;
  const enemyBias = Math.abs(enemy.y - player.y) < arena.h * 0.2 || Math.abs(enemy.x - player.x) < arena.w * 0.2;
  const pressureChance =
    enemyDanger.score > 0.95
    || enemyNearWall
    || (enemyDanger.score > 0.5 && Math.random() < 0.62)
    || (enemyBias && Math.random() < 0.4)
    || Math.random() < 0.16;

  if (currentDanger.score < 0.95 && pressureChance) {
    ai.useTimer = 0;
    ai.useDelay = randRange(0.75, 1.3);
    ai.lastHasChain = false;
    return true;
  }
  return false;
}
