export interface EncounterModifiers {
  chainSpawnIntervalMultiplier?: number;
  chainSpawnCountBonus?: number;
  itemRespawnRateMultiplier?: number;
  mirrorBounceCount?: number;
}

export interface EncounterConfig {
  id: "chainRush" | "itemFever" | "mirrorArena";
  name: string;
  description: string;
  modifiers: EncounterModifiers;
}

export const ENCOUNTERS: EncounterConfig[] = [
  {
    id: "chainRush",
    name: "Chain Rush",
    description: "Chains spawn faster and stack up sooner.",
    modifiers: {
      chainSpawnIntervalMultiplier: 0.68,
      chainSpawnCountBonus: 1,
    },
  },
  {
    id: "itemFever",
    name: "Item Fever",
    description: "Items respawn rapidly for nonstop pickups.",
    modifiers: {
      itemRespawnRateMultiplier: 2.15,
    },
  },
  {
    id: "mirrorArena",
    name: "Mirror Arena",
    description: "Most straight chains bounce once off the far wall.",
    modifiers: {
      mirrorBounceCount: 1,
    },
  },
];

export function getRandomEncounter(): EncounterConfig {
  return ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)];
}
