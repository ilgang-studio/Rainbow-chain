export const CHAIN_TYPES = ["normal", "rush", "turn", "fake", "giant", "tracking", "phase"] as const;

export type ChainType = (typeof CHAIN_TYPES)[number];
export type BattleStatus = "idle" | "active" | "ended";

export interface BattleConfig {
  worldWidth: number;
  worldHeight: number;
  itemPickupRadius: number;
  itemRespawnMs: number;
  chainWarningMs: number;
  chainHitRadius: number;
  chainRange: number;
}

export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  worldWidth: 1280,
  worldHeight: 720,
  itemPickupRadius: 72,
  itemRespawnMs: 5_000,
  chainWarningMs: 700,
  chainHitRadius: 64,
  chainRange: 1_280,
};
