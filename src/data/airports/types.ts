export type RunwaySurface = "asphalt" | "concrete" | "grass" | "gravel" | "unknown";

export interface Runway {
  /** e.g. "07/25" */
  ident: string;
  /** Magnetic heading in degrees for each end, matching the order in `ident`. */
  headingsMagDeg: [number, number];
  lengthM: number;
  widthM: number;
  surface: RunwaySurface;
  /**
   * Take-off/landing distance available, if published separately from the
   * physical runway length (e.g. displaced thresholds). Falls back to
   * `lengthM` when not given.
   */
  toraLdaM?: number;
}

export interface Frequency {
  label: string;
  mhz: number;
}

export interface NotamSourceConfig {
  status: "configured" | "unconfigured";
  /** Human-facing link to the official briefing source for this airport. */
  briefingUrl: string;
  note?: string;
}

export interface Airport {
  icao: string;
  name: string;
  country: string;
  coordinates: { lat: number; lon: number };
  elevationFt: number;
  magneticVariationDeg: number;
  patternAltitudeFt?: number;
  /**
   * ICAO of the station whose METAR/TAF should be shown — many small VFR
   * fields (like EDKA) have no automated weather station of their own, so
   * this points at the nearest reporting aerodrome. Defaults to `icao`
   * when the airport reports its own weather.
   */
  weatherStationIcao: string;
  weatherStationNote?: string;
  /**
   * An unofficial but on-field automated weather source that should be used
   * for *current conditions* instead of weatherStationIcao's METAR (the TAF
   * forecast still always comes from weatherStationIcao, since these local
   * sources are observation-only). Add a new fetcher under
   * src/lib/sources/ and scripts/fetchers/ for each new kind.
   */
  localMetarSource?: "wetter-edka";
  runways: Runway[];
  frequencies: Frequency[];
  notamSource: NotamSourceConfig;
  /** Short, paraphrased operational notes (local procedures, equipment) — not verbatim from any copyrighted chart. */
  notes?: string[];
  /** Where this reference data came from, for traceability — not a legal source of truth. */
  sourceNote: string;
}
