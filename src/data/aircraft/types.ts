export interface VSpeed {
  label: string;
  kias: number;
  note?: string;
}

export interface AircraftLimits {
  maxTakeoffWeightLb: number;
  maxLandingWeightLb: number;
  emptyWeightLb: number;
  fuelCapacityUsGal: number;
}

export interface Aircraft {
  id: string;
  manufacturer: string;
  model: string;
  engine: string;
  limits: AircraftLimits;
  vSpeeds: VSpeed[];
  /**
   * Which takeoff/landing performance UI to render for this aircraft — see
   * src/components/PerformanceCalculator.tsx. Each aircraft with digitized
   * POH charts gets its own model module under src/lib/aircraft-performance/
   * and matching chart components under src/components/charts/, since the
   * underlying nomogram geometry is inherently specific to that aircraft's
   * actual printed chart, not something a generic grid can represent.
   */
  performanceModel: "pa28-161-cadet";
}
