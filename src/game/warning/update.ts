import type { Arena } from "../arena";
import { rng } from "../rng";
import type { EncounterConfig } from "../encounter";
import type { Player } from "../player";
import {
  CHAIN_CONFIGS,
  CHAIN_TYPE_IDS,
  FLASH_DURATION,
  LINK_R,
  MAX_ZONES_PER_ARENA,
  WARNING_DURATION,
  clamp,
  normalizeAngle,
  type Orientation,
  type Zone,
} from "./shared";
import { zones, spawnTimers } from "./state";

interface ZoneSeed {
  chainId?: string;
  orientation: Orientation;
  centerPos: number;
  direction: 1 | -1;
  turnDir: 1 | -1;
  turnRatio: number;
  fakePos?: number;
  phase?: Zone["phase"];
  elapsed?: number;
  warningDurationOverride?: number;
}

function hashToUnit(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000000) / 1000000;
}

function currentSpawnInterval(gameTime: number): number {
  return Math.max(1.15, 4.8 - gameTime * 0.02);
}

function spawnCount(gameTime: number): number {
  if (gameTime >= 165) return 3;
  if (gameTime >= 95) return 2;
  return 1;
}

function practiceSpawnIntervalMultiplier(gameTime: number): number {
  if (gameTime < 30) return 1.55;
  if (gameTime < 60) return 1.3;
  if (gameTime < 90) return 1.08;
  return 0.9;
}

function practiceSpawnBonus(gameTime: number): number {
  if (gameTime < 120) return 0;
  return 1;
}

function buildZone(
  arenaIdx: 0 | 1,
  arena: Arena,
  chainType = "normal",
  encounter: EncounterConfig | null | undefined,
  seed: ZoneSeed,
): Zone {
  const orientation = seed.orientation;
  const direction = seed.direction;
  const turnDir = seed.turnDir;
  const turnRatio = seed.turnRatio;
  const isVert = orientation === "vertical";
  let centerPos = seed.centerPos;
  let fakePos = seed.fakePos ?? centerPos;

  if (chainType === "fake" && seed.fakePos == null) {
    const axisCenter = isVert ? arena.x + arena.w / 2 : arena.y + arena.h / 2;
    fakePos = centerPos;
    centerPos = 2 * axisCenter - centerPos;
  }

  const fullLen = isVert ? arena.h : arena.w;
  const base = isVert ? arena.y : arena.x;
  const adjBase = base + LINK_R;
  const adjFullLen = fullLen - 2 * LINK_R;

  let turnPoint: number;
  let seg1Len: number;
  let seg2Len: number;

  if (chainType === "turn") {
    if (direction === 1) {
      turnPoint = adjBase + adjFullLen * turnRatio;
      seg1Len = turnPoint - adjBase;
    } else {
      turnPoint = adjBase + adjFullLen * (1 - turnRatio);
      seg1Len = adjBase + adjFullLen - turnPoint;
    }
    seg2Len = isVert
      ? (turnDir === 1 ? (arena.x + arena.w - LINK_R) - centerPos : centerPos - (arena.x + LINK_R))
      : (turnDir === 1 ? (arena.y + arena.h - LINK_R) - centerPos : centerPos - (arena.y + LINK_R));
  } else {
    turnPoint = 0;
    seg1Len = 0;
    seg2Len = 0;
  }

  const cfg = CHAIN_CONFIGS[chainType] ?? CHAIN_CONFIGS.normal;
  const chainRadius = cfg.linkRadius ?? 0;
  const trackHalfWidth = (cfg.chainWidth ?? 16) * 0.5;
  const trackHeadX = isVert
    ? centerPos
    : (direction === 1 ? arena.x + trackHalfWidth : arena.x + arena.w - trackHalfWidth);
  const trackHeadY = isVert
    ? (direction === 1 ? arena.y + trackHalfWidth : arena.y + arena.h - trackHalfWidth)
    : centerPos;
  const trackStartX = trackHeadX;
  const trackStartY = trackHeadY;
  const trackDirX = isVert ? 0 : direction;
  const trackDirY = isVert ? direction : 0;
  const trackBaseAngle = Math.atan2(trackDirY, trackDirX);
  const trackTurnAngle = trackBaseAngle;
  const trackTurned = false;
  const trackPoints = [{ x: trackHeadX, y: trackHeadY }];

  return {
    chainId: seed.chainId,
    orientation,
    centerPos,
    arenaIdx,
    phase: seed.phase ?? "warning",
    elapsed: seed.elapsed ?? 0,
    direction,
    drawLength: 0,
    exitOffset: 0,
    chainType,
    fakePos,
    chainRadius,
    turnDir,
    turnPoint,
    seg1Len,
    seg2Len,
    trackHeadX,
    trackHeadY,
    trackDirX,
    trackDirY,
    trackStartX,
    trackStartY,
    trackBaseAngle,
    trackTurnAngle,
    trackTurned,
    trackPoints,
    speedMultiplier: encounter?.modifiers.chainLaunchSpeedMultiplier ?? 1,
    mirrorRemaining: 0,
    mirrorTurnUp: false,
    mirrorTurnX: 0,
    mirrorTurnLength: 0,
    warningDurationOverride: seed.warningDurationOverride,
  };
}

function getRandomSeed(arena: Arena): ZoneSeed {
  const orientation: Orientation = rng() < 0.5 ? "horizontal" : "vertical";
  const pad = Math.min(arena.w, arena.h) * 0.15;
  const centerPos = orientation === "vertical"
    ? arena.x + pad + rng() * (arena.w - pad * 2)
    : arena.y + pad + rng() * (arena.h - pad * 2);
  return {
    orientation,
    centerPos,
    direction: rng() < 0.5 ? 1 : -1,
    turnDir: rng() < 0.5 ? 1 : -1,
    turnRatio: 0.4 + rng() * 0.2,
  };
}

function spawnZone(arenaIdx: 0 | 1, arena: Arena, chainType = "normal", encounter?: EncounterConfig | null): void {
  zones.push(buildZone(arenaIdx, arena, chainType, encounter, getRandomSeed(arena)));
}

function applyPhaseProgress(zone: Zone, arena: Arena): void {
  const cfg = CHAIN_CONFIGS[zone.chainType] ?? CHAIN_CONFIGS.normal;
  if (zone.phase === "extending" && zone.chainType !== "tracking") {
    const lkR = cfg.linkRadius ?? LINK_R;
    const maxLen = zone.chainType === "turn"
      ? zone.seg1Len + zone.seg2Len
      : (zone.orientation === "vertical" ? arena.h : arena.w) - 2 * lkR;
    const extendDuration = cfg.extendDuration / zone.speedMultiplier;
    zone.drawLength = Math.min(maxLen, maxLen * (zone.elapsed / extendDuration));
    return;
  }

  if (zone.phase === "active" && zone.chainType !== "tracking") {
    const lkR = cfg.linkRadius ?? LINK_R;
    zone.drawLength = zone.chainType === "turn"
      ? zone.seg1Len + zone.seg2Len
      : (zone.orientation === "vertical" ? arena.h : arena.w) - 2 * lkR;
    return;
  }

  if (zone.phase === "exiting" && zone.chainType !== "tracking" && zone.chainType !== "turn") {
    const lkR = cfg.linkRadius ?? LINK_R;
    const adjFullLen = (zone.orientation === "vertical" ? arena.h : arena.w) - 2 * lkR;
    zone.exitOffset = adjFullLen * (zone.elapsed / cfg.exitDuration);
  }
}

export function syncServerChain(
  arenaIdx: 0 | 1,
  arena: Arena,
  payload: {
    chainId: string;
    chainType: string;
    originX: number;
    originY: number;
    dx: number;
    dy: number;
    warningAt: number;
    fireAt: number;
    firedAt?: number;
    now?: number;
  },
  encounter?: EncounterConfig | null,
): void {
  const cfg = CHAIN_CONFIGS[payload.chainType] ?? CHAIN_CONFIGS.normal;
  const orientation: Orientation = Math.abs(payload.dy) > Math.abs(payload.dx) ? "vertical" : "horizontal";
  const direction: 1 | -1 = orientation === "vertical"
    ? (payload.dy >= 0 ? 1 : -1)
    : (payload.dx >= 0 ? 1 : -1);
  const centerPos = orientation === "vertical" ? payload.originX : payload.originY;
  const axisCenter = orientation === "vertical" ? arena.x + arena.w / 2 : arena.y + arena.h / 2;
  const fakePos = payload.chainType === "fake" ? 2 * axisCenter - centerPos : centerPos;
  const warningLeadSec = Math.max(0, (payload.fireAt - payload.warningAt) / 1000 - FLASH_DURATION);
  const nowMs = payload.now ?? Date.now();
  const extendStartAt = payload.firedAt ?? payload.fireAt;
  let phase: Zone["phase"] = "warning";
  let elapsed = Math.max(0, (nowMs - payload.warningAt) / 1000);

  if (nowMs >= payload.warningAt + warningLeadSec * 1000) {
    phase = "flash";
    elapsed = Math.max(0, (nowMs - (payload.warningAt + warningLeadSec * 1000)) / 1000);
  }

  if (nowMs >= extendStartAt) {
    const extendingElapsed = Math.max(0, (nowMs - extendStartAt) / 1000);
    const extendDuration = cfg.extendDuration;
    const activeDuration = cfg.activeDuration;
    if (extendingElapsed < extendDuration) {
      phase = "extending";
      elapsed = extendingElapsed;
    } else if (extendingElapsed < extendDuration + activeDuration) {
      phase = "active";
      elapsed = extendingElapsed - extendDuration;
    } else {
      phase = "exiting";
      elapsed = extendingElapsed - extendDuration - activeDuration;
    }
  }

  const seed: ZoneSeed = {
    chainId: payload.chainId,
    orientation,
    centerPos,
    direction,
    turnDir: hashToUnit(payload.chainId, 17) < 0.5 ? 1 : -1,
    turnRatio: 0.4 + hashToUnit(payload.chainId, 31) * 0.2,
    fakePos,
    phase,
    elapsed,
    warningDurationOverride: warningLeadSec,
  };

  const nextZone = buildZone(arenaIdx, arena, payload.chainType, encounter, seed);
  applyPhaseProgress(nextZone, arena);

  const existingIdx = zones.findIndex((zone) => zone.chainId === payload.chainId);
  if (existingIdx >= 0) {
    zones[existingIdx] = nextZone;
    return;
  }
  zones.push(nextZone);
}

function canMirrorBounce(z: Zone): boolean {
  return z.chainType === "normal" || z.chainType === "rush";
}

function getTrackingBoundaryDistance(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  arena: Arena,
  inset: number,
): number {
  const minX = arena.x + inset;
  const maxX = arena.x + arena.w - inset;
  const minY = arena.y + inset;
  const maxY = arena.y + arena.h - inset;
  let best = Number.POSITIVE_INFINITY;

  if (Math.abs(dirX) > 0.0001) {
    const tx = dirX > 0 ? (maxX - x) / dirX : (minX - x) / dirX;
    if (tx > 0) best = Math.min(best, tx);
  }

  if (Math.abs(dirY) > 0.0001) {
    const ty = dirY > 0 ? (maxY - y) / dirY : (minY - y) / dirY;
    if (ty > 0) best = Math.min(best, ty);
  }

  return Number.isFinite(best) ? best : 0;
}

function updateTrackingZone(z: Zone, target: Player, arena: Arena): boolean {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const trackingStrength = cfg.trackingStrength ?? 0.16;
  const maxTurnRate = cfg.maxTurnRate ?? 0.9;
  const speed = (cfg.speed ?? 260) * z.speedMultiplier;
  const trackHalfWidth = (cfg.chainWidth ?? 16) * 0.5;
  const primarySpan = (z.orientation === "vertical" ? arena.h : arena.w) - trackHalfWidth * 2;
  const bendLen = Math.max(trackHalfWidth * 3, primarySpan * 0.24);
  const visibleLen = speed * z.elapsed;

  const bendX = z.trackStartX + Math.cos(z.trackBaseAngle) * bendLen;
  const bendY = z.trackStartY + Math.sin(z.trackBaseAngle) * bendLen;

  z.trackPoints.length = 0;
  z.trackPoints.push({ x: z.trackStartX, y: z.trackStartY });

  if (visibleLen <= bendLen) {
    z.trackHeadX = z.trackStartX + Math.cos(z.trackBaseAngle) * visibleLen;
    z.trackHeadY = z.trackStartY + Math.sin(z.trackBaseAngle) * visibleLen;
    z.trackDirX = Math.cos(z.trackBaseAngle);
    z.trackDirY = Math.sin(z.trackBaseAngle);
    z.trackPoints.push({ x: z.trackHeadX, y: z.trackHeadY });
    return false;
  }

  if (!z.trackTurned) {
    const targetAngle = Math.atan2(target.y - bendY, target.x - bendX);
    const turnDelta = clamp(
      normalizeAngle(targetAngle - z.trackBaseAngle) * trackingStrength,
      -maxTurnRate,
      maxTurnRate,
    );
    z.trackTurnAngle = z.trackBaseAngle + turnDelta;
    z.trackTurned = true;
  }

  const maxSecondLen = getTrackingBoundaryDistance(
    bendX,
    bendY,
    Math.cos(z.trackTurnAngle),
    Math.sin(z.trackTurnAngle),
    arena,
    trackHalfWidth,
  );
  const totalLen = bendLen + maxSecondLen;
  const clampedVisibleLen = Math.min(totalLen, speed * z.elapsed);
  const secondLen = Math.max(0, clampedVisibleLen - bendLen);
  z.trackDirX = Math.cos(z.trackTurnAngle);
  z.trackDirY = Math.sin(z.trackTurnAngle);
  z.trackHeadX = bendX + z.trackDirX * secondLen;
  z.trackHeadY = bendY + z.trackDirY * secondLen;

  z.trackPoints.push({ x: bendX, y: bendY });
  z.trackPoints.push({ x: z.trackHeadX, y: z.trackHeadY });
  return speed * z.elapsed >= totalLen;
}

export function updateWarnings(
  dt: number,
  arenas: [Arena, Arena],
  players: [Player, Player],
  gameTime: number,
  options?: { practiceMode?: boolean; onChainLaunch?: () => void },
  encounter?: EncounterConfig | null,
): void {
  const practiceMode = options?.practiceMode ?? false;
  const interval =
    currentSpawnInterval(gameTime)
    * (practiceMode ? practiceSpawnIntervalMultiplier(gameTime) : 1)
    * (encounter?.modifiers.chainSpawnIntervalMultiplier ?? 1);
  const count =
    spawnCount(gameTime)
    + (practiceMode ? practiceSpawnBonus(gameTime) : 0)
    + (encounter?.modifiers.chainSpawnCountBonus ?? 0);

  for (let i = 0; i < (practiceMode ? 1 : 2); i++) {
    spawnTimers[i] += dt;
    if (spawnTimers[i] < interval) continue;
    spawnTimers[i] = 0;

    let existing = 0;
    for (let j = 0; j < zones.length; j++) {
      if (zones[j].arenaIdx === i) existing++;
    }
    const toSpawn = Math.min(count, MAX_ZONES_PER_ARENA - existing);
    for (let n = 0; n < toSpawn; n++) {
      const t = CHAIN_TYPE_IDS[Math.floor(rng() * CHAIN_TYPE_IDS.length)];
      spawnZone(i as 0 | 1, arenas[i], t, encounter);
    }
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.elapsed += dt;

    if (z.phase === "warning") {
      const wDur = z.warningDurationOverride
        ?? (CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal).warningDuration
        ?? WARNING_DURATION;
      if (z.elapsed >= wDur) {
        z.phase = "flash";
        z.elapsed = 0;
      }
    } else if (z.phase === "flash") {
      if (z.elapsed >= FLASH_DURATION) {
        options?.onChainLaunch?.();
        z.phase = "extending";
        z.elapsed = 0;
        z.drawLength = 0;
      }
    } else if (z.phase === "extending") {
      const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
      if (z.chainType === "tracking") {
        const reachedWall = updateTrackingZone(z, players[z.arenaIdx], arenas[z.arenaIdx]);
        if (reachedWall) {
          z.phase = "active";
          z.elapsed = 0;
        }
        continue;
      }
      const arena = arenas[z.arenaIdx];
      const lkR = cfg.linkRadius ?? LINK_R;
      const maxLen = z.chainType === "turn"
        ? z.seg1Len + z.seg2Len
        : (z.orientation === "vertical" ? arena.h : arena.w) - 2 * lkR;
      const extendDuration = cfg.extendDuration / z.speedMultiplier;
      z.drawLength = Math.min(maxLen, maxLen * (z.elapsed / extendDuration));
      if (z.elapsed >= extendDuration) {
        if (z.mirrorRemaining > 0 && canMirrorBounce(z) && z.orientation === "horizontal") {
          z.mirrorRemaining--;
          z.phase = "active";
          z.elapsed = 0;
          z.drawLength = maxLen;
          z.mirrorTurnUp = true;
          z.mirrorTurnX = z.direction === 1 ? arena.x + arena.w - lkR : arena.x + lkR;
          z.mirrorTurnLength = z.centerPos - (arena.y + lkR);
        } else {
          z.phase = "active";
          z.elapsed = 0;
          z.drawLength = maxLen;
        }
      }
    } else if (z.phase === "active") {
      const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
      if (z.chainType === "tracking") {
        if (z.elapsed >= cfg.activeDuration) {
          z.phase = "exiting";
          z.elapsed = 0;
          z.exitOffset = 0;
        }
      } else if (z.mirrorTurnUp) {
        if (z.elapsed >= cfg.activeDuration) zones.splice(i, 1);
      } else if (z.elapsed >= cfg.activeDuration) {
        z.phase = "exiting";
        z.elapsed = 0;
        z.exitOffset = 0;
      }
    } else {
      const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
      if (z.chainType === "tracking") {
        if (z.elapsed >= cfg.exitDuration) zones.splice(i, 1);
      } else if (z.chainType === "turn") {
        if (z.elapsed >= cfg.exitDuration) zones.splice(i, 1);
      } else {
        const arena = arenas[z.arenaIdx];
        const fullLen = z.orientation === "vertical" ? arena.h : arena.w;
        const lkR = cfg.linkRadius ?? LINK_R;
        const adjFullLen = fullLen - 2 * lkR;
        z.exitOffset = adjFullLen * (z.elapsed / cfg.exitDuration);
        if (z.exitOffset >= adjFullLen) zones.splice(i, 1);
      }
    }
  }
}

export function fireChain(arenaIdx: 0 | 1, arenas: [Arena, Arena], chainType: string, encounter?: EncounterConfig | null): void {
  spawnZone(arenaIdx, arenas[arenaIdx], chainType, encounter);
}
