export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR";

export interface CloudLayer {
  cover: string; // FEW, SCT, BKN, OVC, ...
  baseFt: number | null;
}

export interface MetarData {
  raw: string;
  obsTime: string; // ISO
  /** Human-readable attribution, e.g. "wetter-edka.de (on-field AWS)". */
  source: string;
  tempC: number | null;
  dewpointC: number | null;
  windDirDeg: number | "VRB" | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  visibilitySM: number | null;
  altimeterHpa: number | null;
  flightCategory: FlightCategory | null;
  clouds: CloudLayer[];
}

export interface TafData {
  raw: string;
  source: string;
}

export interface WeatherSnapshot {
  icao: string;
  fetchedAt: string; // ISO
  ok: boolean;
  error: string | null;
  metar: MetarData | null;
  taf: TafData | null;
}

/** Lowest ceiling (BKN/OVC base) in feet, or null if the sky is clear/few/sct only. */
export function ceilingFt(clouds: CloudLayer[]): number | null {
  const ceilingLayers = clouds.filter((c) => c.cover === "BKN" || c.cover === "OVC");
  if (ceilingLayers.length === 0) return null;
  return Math.min(...ceilingLayers.map((c) => c.baseFt ?? Infinity));
}

/**
 * Standard US/ICAO-style flight category thresholds, used as a fallback
 * when the upstream API doesn't supply `fltCat` directly.
 */
export function computeFlightCategory(visibilitySM: number | null, ceiling: number | null): FlightCategory {
  const vis = visibilitySM ?? Infinity;
  const ceil = ceiling ?? Infinity;
  if (vis < 1 || ceil < 500) return "LIFR";
  if (vis < 3 || ceil < 1000) return "IFR";
  if (vis <= 5 || ceil <= 3000) return "MVFR";
  return "VFR";
}
