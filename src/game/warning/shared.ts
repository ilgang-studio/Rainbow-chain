export type Orientation = "horizontal" | "vertical";
export type Phase = "warning" | "flash" | "extending" | "active" | "exiting";
export interface TrackPoint { x: number; y: number; }

// 새 체인 타입 추가 시 여기에만 항목을 추가하면 됩니다.
export interface ChainConfig {
  extendDuration:   number;  // 뻗는 데 걸리는 시간 (초)
  activeDuration:   number;  // 완전히 뻗은 뒤 유지 시간 (초)
  exitDuration:     number;  // 아레나 밖으로 나가는 시간 (초)
  warningColor:     string;  // 경고 띠/중앙선 색상
  linkColor:        string;  // 체인 링크 + glow 색상
  warningDuration?: number;  // 경고 단계 지속 시간 (미지정 시 WARNING_DURATION)
  linkRadius?:      number;  // 링크 반지름 (미지정 시 LINK_R = 3)
  bandHalfWidth?:   number;  // 경고 띠 반폭 (미지정 시 BAND_HALF_WIDTH = 24)
  trackingStrength?: number; // Tracking 체인의 유도 강도
  maxTurnRate?:      number; // Tracking 체인의 최대 회전 속도 (rad/s)
  speed?:            number; // Tracking 체인 헤드 이동 속도
  chainWidth?:       number; // Tracking 체인 몸통 두께
  lifetime?:         number; // Tracking 체인 생존 시간
  phaseVisibleDuration?: number; // Phase 체인 실체화 시간
  phaseHiddenDuration?:  number; // Phase 체인 비실체화 시간
  phaseFadeDuration?:    number; // Phase 체인 전환 페이드 시간
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
    extendDuration: 0.55,
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
    warningDuration: 2.6,
  },
  giant: {
    extendDuration: 0.80,
    activeDuration: 2.5,
    exitDuration:   0.60,
    warningColor:   "#2266ff",
    linkColor:      "#4499ff",
    linkRadius:     9,
    bandHalfWidth:  54,
  },
  tracking: {
    extendDuration:   0.01,
    activeDuration:   2.8,
    exitDuration:     0.01,
    warningDuration:  1.4,
    warningColor:     "#00cc66",
    linkColor:        "#44ff99",
    trackingStrength: 0.78,
    maxTurnRate:      1.05,
    speed:            260,
    chainWidth:       16,
    lifetime:         2.8,
  },
  phase: {
    extendDuration:        0.45,
    activeDuration:        2.8,
    exitDuration:          0.45,
    warningColor:          "#ff9a1f",
    linkColor:             "#ffb347",
    phaseVisibleDuration:  0.7,
    phaseHiddenDuration:   0.5,
    phaseFadeDuration:     0.12,
  },
};

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
  chainType:   string;
  fakePos:     number;
  chainRadius: number;
  turnDir:     1 | -1;
  turnPoint:   number;
  seg1Len:     number;
  seg2Len:     number;
  trackHeadX:  number;
  trackHeadY:  number;
  trackDirX:   number;
  trackDirY:   number;
  trackStartX: number;
  trackStartY: number;
  trackBaseAngle: number;
  trackTurnAngle: number;
  trackTurned: boolean;
  trackPoints: TrackPoint[];
}

export const WARNING_DURATION    = 1.8;
export const FLASH_DURATION      = 0.5;
export const SPAWN_INTERVAL      = 4.0;
export const BAND_HALF_WIDTH     = 24;
export const MAX_ZONES_PER_ARENA = 6;
export const LINK_R              = 3;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export interface PhaseCycleVisual {
  solid: boolean;
  linkAlpha: number;
  glowAlpha: number;
}

export function getPhaseCycleVisual(elapsed: number, cfg: ChainConfig): PhaseCycleVisual {
  const visibleDur = cfg.phaseVisibleDuration ?? 0.7;
  const hiddenDur = cfg.phaseHiddenDuration ?? 0.5;
  const fadeDur = Math.min(cfg.phaseFadeDuration ?? 0.12, visibleDur * 0.5, hiddenDur * 0.5);
  const cycleDur = visibleDur + hiddenDur;
  const cycleT = cycleDur > 0 ? elapsed % cycleDur : 0;
  const hiddenAlpha = 0.22;
  const hiddenGlow = 0.04;

  if (cycleT < visibleDur - fadeDur) {
    return { solid: true, linkAlpha: 1, glowAlpha: 1 };
  }

  if (cycleT < visibleDur) {
    const t = (cycleT - (visibleDur - fadeDur)) / fadeDur;
    return {
      solid: true,
      linkAlpha: 1 + (hiddenAlpha - 1) * t,
      glowAlpha: 1 + (hiddenGlow - 1) * t,
    };
  }

  if (cycleT < visibleDur + hiddenDur - fadeDur) {
    return { solid: false, linkAlpha: hiddenAlpha, glowAlpha: hiddenGlow };
  }

  const t = (cycleT - (visibleDur + hiddenDur - fadeDur)) / fadeDur;
  return {
    solid: false,
    linkAlpha: hiddenAlpha + (1 - hiddenAlpha) * t,
    glowAlpha: hiddenGlow + (1 - hiddenGlow) * t,
  };
}
