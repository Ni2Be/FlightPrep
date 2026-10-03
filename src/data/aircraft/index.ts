import type { Aircraft } from "./types";
import { PA28_161_CADET } from "./pa28-161-cadet";

/**
 * Registry of all aircraft the app knows about. To add a new one:
 *   1. Create `src/data/aircraft/<id>.ts` exporting an `Aircraft`.
 *   2. Add a takeoff/landing performance model under
 *      `src/lib/aircraft-performance/` and matching chart components under
 *      `src/components/charts/` (see pa28-161-cadet.ts and
 *      TakeoffNomogram.tsx/LandingNomogram.tsx), then wire them into
 *      `PerformanceCalculator`'s `performanceModel` switch.
 *   3. Add it to this map.
 */
export const AIRCRAFT: Record<string, Aircraft> = {
  "pa28-161-cadet": PA28_161_CADET,
};

export const DEFAULT_AIRCRAFT_ID = "pa28-161-cadet";

export function getAircraft(id: string): Aircraft | undefined {
  return AIRCRAFT[id];
}

export function listAircraft(): Aircraft[] {
  return Object.values(AIRCRAFT);
}

export type { Aircraft, AircraftLimits, VSpeed } from "./types";
