import type { Arena } from "../arena";
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

function currentSpawnInterval(gameTime: number): number {
  return Math.max(0.8, 4.0 - gameTime * 0.06);
}

function spawnCount(gameTime: number): number {
  if (gameTime >= 90) return 3;
  if (gameTime >= 45) return 2;
  return 1;
}

function spawnZone(arenaIdx: 0 | 1, arena: Arena, chainType = "normal", encounter?: EncounterConfig): void {
  const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
  const pad = Math.min(arena.w, arena.h) * 0.15;
  let centerPos = orientation === "vertical"
    ? arena.x + pad + Math.random() * (arena.w - pad * 2)
    : arena.y + pad + Math.random() * (arena.h - pad * 2);
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const turnDir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const isVert = orientation === "vertical";

  const fakePos = centerPos;
  if (chainType === "fake") {
    const axisCenter = isVert ? arena.x + arena.w / 2 : arena.y + arena.h / 2;
    centerPos = 2 * axisCenter - centerPos;
  }

  const fullLen = isVert ? arena.h : arena.w;
  const base = isVert ? arena.y : arena.x;
  const adjBase = base + LINK_R;
  const adjFullLen = fullLen - 2 * LINK_R;
  const turnRatio = 0.4 + Math.random() * 0.2;

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

  zones.push({
    orientation,
    centerPos,
    arenaIdx,
    phase: "warning",
    elapsed: 0,
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
    mirrorRemaining: encounter?.modifiers.mirrorBounceCount ?? 0,
    mirrorTurnUp: false,
    mirrorTurnX: 0,
    mirrorTurnLength: 0,
  });
}

function canMirrorBounce(z: Zone): boolean {
  return z.chainType === "normal" || z.chainType === "rush";
}

function updateTrackingZone(z: Zone, target: Player): void {
  const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
  const trackingStrength = cfg.trackingStrength ?? 0.16;
  const maxTurnRate = cfg.maxTurnRate ?? 0.9;
  const speed = cfg.speed ?? 260;
  const totalLen = speed * (cfg.lifetime ?? cfg.activeDuration);
  const visibleLen = Math.min(totalLen, speed * z.elapsed);
  const bendLen = totalLen * 0.24;

  z.trackPoints.length = 0;
  z.trackPoints.push({ x: z.trackStartX, y: z.trackStartY });

  if (visibleLen <= bendLen) {
    z.trackHeadX = z.trackStartX + Math.cos(z.trackBaseAngle) * visibleLen;
    z.trackHeadY = z.trackStartY + Math.sin(z.trackBaseAngle) * visibleLen;
    z.trackDirX = Math.cos(z.trackBaseAngle);
    z.trackDirY = Math.sin(z.trackBaseAngle);
    z.trackPoints.push({ x: z.trackHeadX, y: z.trackHeadY });
    return;
  }

  const bendX = z.trackStartX + Math.cos(z.trackBaseAngle) * bendLen;
  const bendY = z.trackStartY + Math.sin(z.trackBaseAngle) * bendLen;
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

  const secondLen = visibleLen - bendLen;
  z.trackDirX = Math.cos(z.trackTurnAngle);
  z.trackDirY = Math.sin(z.trackTurnAngle);
  z.trackHeadX = bendX + z.trackDirX * secondLen;
  z.trackHeadY = bendY + z.trackDirY * secondLen;

  z.trackPoints.push({ x: bendX, y: bendY });
  z.trackPoints.push({ x: z.trackHeadX, y: z.trackHeadY });
}

export function updateWarnings(
  dt: number,
  arenas: [Arena, Arena],
  players: [Player, Player],
  gameTime: number,
  options?: { practiceMode?: boolean },
  encounter?: EncounterConfig,
): void {
  const practiceMode = options?.practiceMode ?? false;
  const interval =
    currentSpawnInterval(gameTime)
    * (practiceMode ? 0.58 : 1)
    * (encounter?.modifiers.chainSpawnIntervalMultiplier ?? 1);
  const count =
    spawnCount(gameTime)
    + (practiceMode ? 1 : 0)
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
      const t = CHAIN_TYPE_IDS[Math.floor(Math.random() * CHAIN_TYPE_IDS.length)];
      spawnZone(i as 0 | 1, arenas[i], t, encounter);
    }
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.elapsed += dt;

    if (z.phase === "warning") {
      const wDur = (CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal).warningDuration ?? WARNING_DURATION;
      if (z.elapsed >= wDur) {
        z.phase = "flash";
        z.elapsed = 0;
      }
    } else if (z.phase === "flash") {
      if (z.elapsed >= FLASH_DURATION) {
        z.phase = z.chainType === "tracking" ? "active" : "extending";
        z.elapsed = 0;
        z.drawLength = 0;
      }
    } else if (z.phase === "extending") {
      const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
      const arena = arenas[z.arenaIdx];
      const lkR = cfg.linkRadius ?? LINK_R;
      const maxLen = z.chainType === "turn"
        ? z.seg1Len + z.seg2Len
        : (z.orientation === "vertical" ? arena.h : arena.w) - 2 * lkR;
      z.drawLength = Math.min(maxLen, maxLen * (z.elapsed / cfg.extendDuration));
      if (z.elapsed >= cfg.extendDuration) {
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
        updateTrackingZone(z, players[z.arenaIdx]);
        if (z.elapsed >= (cfg.lifetime ?? cfg.activeDuration)) zones.splice(i, 1);
      } else if (z.mirrorTurnUp) {
        if (z.elapsed >= cfg.activeDuration) zones.splice(i, 1);
      } else if (z.elapsed >= cfg.activeDuration) {
        z.phase = "exiting";
        z.elapsed = 0;
        z.exitOffset = 0;
      }
    } else {
      const cfg = CHAIN_CONFIGS[z.chainType] ?? CHAIN_CONFIGS.normal;
      if (z.chainType === "turn") {
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

export function fireChain(arenaIdx: 0 | 1, arenas: [Arena, Arena], chainType: string, encounter?: EncounterConfig): void {
  spawnZone(arenaIdx, arenas[arenaIdx], chainType, encounter);
}
