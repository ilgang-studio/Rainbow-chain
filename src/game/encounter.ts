export interface EncounterModifiers {
  chainSpawnIntervalMultiplier?: number;
  chainSpawnCountBonus?: number;
  itemRespawnRateMultiplier?: number;
  chainLaunchSpeedMultiplier?: number;
}

export interface EncounterConfig {
  id: "chainStorm" | "itemFever" | "overclock";
  name: string;
  description: string;
  modifiers: EncounterModifiers;
}

export const ENCOUNTERS: EncounterConfig[] = [
  {
    id: "chainStorm",
    name: "Chain Storm",
    description: "Chains are produced faster across the arena.",
    modifiers: {
      chainSpawnIntervalMultiplier: 0.68,
      chainSpawnCountBonus: 1,
    },
  },
  {
    id: "itemFever",
    name: "Item Fever",
    description: "Items spawn more often for nonstop pickups.",
    modifiers: {
      itemRespawnRateMultiplier: 2.15,
    },
  },
  {
    id: "overclock",
    name: "Overclock",
    description: "Chains launch faster once the warning ends.",
    modifiers: {
      chainLaunchSpeedMultiplier: 1.4,
    },
  },
];

export function getRandomEncounter(): EncounterConfig | null {
  const poolSize = ENCOUNTERS.length + 1;
  const roll = Math.floor(Math.random() * poolSize);
  if (roll === ENCOUNTERS.length) return null;
  return ENCOUNTERS[roll];
}
