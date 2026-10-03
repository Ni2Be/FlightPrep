import type { Airport } from "./types";
import { EDKA } from "./EDKA";

/**
 * Registry of all airports the app knows about. To add a new one:
 *   1. Create `src/data/airports/<ICAO>.ts` exporting an `Airport`.
 *   2. Add it to this map.
 *   3. Add its ICAO code to `AIRPORT_ICAOS` in scripts/fetch-data.mjs so the
 *      scheduled weather/NOTAM refresh picks it up too.
 */
export const AIRPORTS: Record<string, Airport> = {
  EDKA,
};

export const DEFAULT_AIRPORT_ICAO = "EDKA";

export function getAirport(icao: string): Airport | undefined {
  return AIRPORTS[icao];
}

export function listAirports(): Airport[] {
  return Object.values(AIRPORTS);
}

export type { Airport, Runway, Frequency, NotamSourceConfig, RunwaySurface } from "./types";
