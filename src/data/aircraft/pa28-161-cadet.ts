import type { Aircraft } from "./types";

/**
 * Piper PA-28-161 Cadet.
 *
 * `limits.maxTakeoffWeightLb` matches the real POH performance charts'
 * reference weight (1055 kg = 2325 lb) — see
 * src/lib/aircraft-performance/pa28-161-cadet.ts for the takeoff/landing
 * distance model itself (ported from a worked reconstruction of those
 * charts, calibrated only at their printed examples — not certified data).
 * The rest of the V-speeds below are typical published figures for the
 * type and still need to be cross-checked against the specific aircraft's
 * POH/AFM.
 */
export const PA28_161_CADET: Aircraft = {
  id: "pa28-161-cadet",
  manufacturer: "Piper",
  model: "PA-28-161 Cadet",
  engine: "Lycoming O-320-D3G, 160 hp",
  limits: {
    maxTakeoffWeightLb: 2325,
    maxLandingWeightLb: 2325,
    emptyWeightLb: 1400,
    fuelCapacityUsGal: 48,
  },
  vSpeeds: [
    { label: "Vso", kias: 44, note: "Stall, landing config" },
    { label: "Vs1", kias: 50, note: "Stall, flaps up" },
    { label: "Vx", kias: 62, note: "Best angle of climb" },
    { label: "Vy", kias: 76, note: "Best rate of climb" },
    { label: "Vfe", kias: 102, note: "Max flap extended" },
    { label: "Vno", kias: 126, note: "Max structural cruising" },
    { label: "Vne", kias: 160, note: "Never exceed" },
    { label: "Va (max gross)", kias: 113, note: "Maneuvering" },
    { label: "Vapp (landing chart)", kias: 63, note: "Approach speed used on the POH landing distance chart" },
  ],
  performanceModel: "pa28-161-cadet",
};
