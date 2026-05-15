import { rng } from "./rng";

export interface EncounterModifiers {
  chainSpawnIntervalMultiplier?: number;
  chainSpawnCountBonus?: number;
  itemRespawnRateMultiplier?: number;
  chainLaunchSpeedMultiplier?: number;
}

export interface EncounterConfig {
  id: "chainStorm" | "itemFever" | "overclock";
  nameKey: string;
  descriptionKey: string;
  modifiers: EncounterModifiers;
}

export const ENCOUNTERS: EncounterConfig[] = [
  {
    id: "chainStorm",
    nameKey: "encounter.chainStorm.name",
    descriptionKey: "encounter.chainStorm.description",
    modifiers: {
      chainSpawnIntervalMultiplier: 0.68,
      chainSpawnCountBonus: 1,
    },
  },
  {
    id: "itemFever",
    nameKey: "encounter.itemFever.name",
    descriptionKey: "encounter.itemFever.description",
    modifiers: {
      itemRespawnRateMultiplier: 2.15,
    },
  },
  {
    id: "overclock",
    nameKey: "encounter.overclock.name",
    descriptionKey: "encounter.overclock.description",
    modifiers: {
      chainLaunchSpeedMultiplier: 1.4,
    },
  },
];

export function getRandomEncounter(): EncounterConfig {
  const roll = Math.floor(rng() * ENCOUNTERS.length);
  return ENCOUNTERS[roll] ?? ENCOUNTERS[0];
}
