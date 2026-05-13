import type { Zone } from "./shared";
import { SPAWN_INTERVAL } from "./shared";

export const zones: Zone[] = [];
export const spawnTimers: [number, number] = [1.2, SPAWN_INTERVAL * 0.5 + 0.9];

const chainBuf: Zone[] = [];

export function getActiveChains(): Zone[] {
  chainBuf.length = 0;
  for (let i = 0; i < zones.length; i++) {
    const ph = zones[i].phase;
    if (ph === "extending" || ph === "active" || ph === "exiting") {
      chainBuf.push(zones[i]);
    }
  }
  return chainBuf;
}

export function resetWarnings(): void {
  zones.length = 0;
  spawnTimers[0] = 1.2;
  spawnTimers[1] = SPAWN_INTERVAL * 0.5 + 0.9;
}
