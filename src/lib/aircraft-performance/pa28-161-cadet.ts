/**
 * Piper PA-28-161 Cadet takeoff/landing distance model.
 *
 * Ported directly (same constants, same formulas) from a working
 * reference reconstruction the aircraft owner supplied
 * (start_und_landestrecke_interaktiv.html), which was itself approximately
 * reconstructed from the two scanned POH nomogram pages and calibrated to
 * their printed worked examples. See that file's own in-page notes for the
 * full derivation — this is a port, not an independent re-derivation.
 *
 * ⚠️ Not certified performance data. An approximation, matched only at the
 * one worked example per chart; not for real flight planning.
 */
import calibrationJson from "@/data/aircraft-performance/pa28-161-cadet.calibration.json";
import { lagrangeInterpolate, lagrangeXY, type TakeoffCalibration, type LandingCalibration } from "./calibration";

export const DEFAULT_TAKEOFF_CALIBRATION = calibrationJson.takeoff as TakeoffCalibration;
export const DEFAULT_LANDING_CALIBRATION = calibrationJson.landing as LandingCalibration;

export const KG_PER_LB = 1 / 2.2046226218;
export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}
export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

// ---------------------------------------------------------------------
// Takeoff — "Startlaufstrecke bei 0°-Klappenstellung"
// ---------------------------------------------------------------------

export const TAKEOFF = Object.freeze({
  refMassKg: 1055,
  exampleAltitudeFt: 1500,
  exampleTempC: 27,
  exampleWindKt: 15,
  exampleDistanceM: 350,
  altitudeGradient: 0.16,
  tempGradient: 0.0062,
  massExponent: 2,
  speedExponent: 0.6,
  windCoefficient: 0.75,
  minMassKg: 725,
  maxMassKg: 1055,
  minPressureFt: 0,
  maxPressureFt: 6000,
  minTempC: -40,
  maxTempC: 40,
  minWindKt: 0,
  maxWindKt: 15,
  fullScaleM: 800,
});

const takeoffExampleFactor =
  (1 + TAKEOFF.altitudeGradient * (TAKEOFF.exampleAltitudeFt / 1000)) *
  (1 + TAKEOFF.tempGradient * (TAKEOFF.exampleTempC - 15)) *
  (1 - TAKEOFF.windCoefficient * (TAKEOFF.exampleWindKt / 50));
export const TAKEOFF_REFERENCE_K = TAKEOFF.exampleDistanceM / takeoffExampleFactor;

/**
 * This multiplicative formula (ported from the reference reconstruction)
 * is only exact at the one worked example it was calibrated against —
 * confirmed by reading real points off the 3000 ft line of the actual
 * chart: at (3000 ft, -40/0/40 °C) it predicts 331/455/579 m, vs. the
 * chart's actual ~225/417/610 m. The temperature sensitivity in particular
 * is ~35% too shallow. Kept only as a fallback for altitudes that don't
 * have real chart readings yet — see `referenceDistanceM` below, and
 * `pa28-161-cadet.calibration.json` for where to add more points as
 * they're read off the chart (or drag them in via `?edit=true`).
 */
function fallbackReferenceDistanceM(pressureFt: number, tempC: number): number {
  return TAKEOFF_REFERENCE_K * (1 + TAKEOFF.altitudeGradient * (pressureFt / 1000)) * (1 + TAKEOFF.tempGradient * (tempC - 15));
}

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

/**
 * Working hypothesis (not yet confirmed by a second verified altitude
 * band): the isolines all share the same temperature-curve *shape*, just
 * shifted up/down by a constant that depends on pressure altitude — i.e.
 * distance(p, t) ≈ distance(p0, t) + offset(p, p0), not a different curve
 * per altitude. Until a second real band exists to confirm/measure that
 * offset directly, this estimates it from the old reconstruction formula's
 * altitude term alone (holding temperature fixed, so only the altitude
 * dependence is used — the part of that formula this chart reading didn't
 * contradict), rather than trusting that formula's temperature dependence
 * too, which the 3000 ft reading showed was wrong.
 */
function altitudeOffsetFromFallback(pressureFt: number, anchorPressureFt: number): number {
  return fallbackReferenceDistanceM(pressureFt, 0) - fallbackReferenceDistanceM(anchorPressureFt, 0);
}

/**
 * Base (reference mass, zero wind) ground roll at a given pressure
 * altitude/OAT. Uses real chart readings from `calibration` whenever it
 * can — exact at a verified altitude band (one with ≥1 point), interpolated
 * between two verified bands that bracket the requested altitude — and
 * otherwise takes the nearest verified band's real curve *shape* and shifts
 * it by an estimated altitude offset (see `altitudeOffsetFromFallback`)
 * rather than falling back to the old formula's temperature dependence,
 * which is known wrong. Falls back to the formula entirely only if no band
 * has any real points yet. `calibration` defaults to the committed
 * `pa28-161-cadet.calibration.json` but can be overridden — e.g. by the
 * `?edit=true` calibration editor previewing unsaved drag changes.
 */
export function referenceDistanceM(pressureFt: number, tempC: number, calibration: TakeoffCalibration = DEFAULT_TAKEOFF_CALIBRATION): number {
  const verifiedLines = calibration.lines.filter((l) => l.points.length > 0);
  if (verifiedLines.length === 0) return fallbackReferenceDistanceM(pressureFt, tempC);

  const exact = verifiedLines.find((l) => l.pressureFt === pressureFt);
  if (exact) return lagrangeInterpolate(exact.points, tempC);

  const verifiedAltitudesFt = verifiedLines.map((l) => l.pressureFt).sort((a, b) => a - b);
  const lineAt = (p: number) => verifiedLines.find((l) => l.pressureFt === p)!.points;

  const lowerAlt = [...verifiedAltitudesFt].reverse().find((p) => p < pressureFt);
  const upperAlt = verifiedAltitudesFt.find((p) => p > pressureFt);
  if (lowerAlt !== undefined && upperAlt !== undefined) {
    const lowerVal = lagrangeInterpolate(lineAt(lowerAlt), tempC);
    const upperVal = lagrangeInterpolate(lineAt(upperAlt), tempC);
    return lerp(pressureFt, lowerAlt, upperAlt, lowerVal, upperVal);
  }

  const nearestAlt = [...verifiedAltitudesFt].sort((a, b) => Math.abs(a - pressureFt) - Math.abs(b - pressureFt))[0];
  const nearestShape = lagrangeInterpolate(lineAt(nearestAlt), tempC);
  return nearestShape + altitudeOffsetFromFallback(pressureFt, nearestAlt);
}

// Every mass-correction line passes through (refMassKg, its own d) by
// construction — that's what the chart's "Bezugslinie 1055 kg" reference
// line means geometrically: all the family curves start there. A point the
// user drags *near* that line doesn't measure anything (the value there is
// defined, not observed), and including it in the fit anyway is actively
// harmful: it's never exactly at massKg, so the fitted curve ends up not
// passing through (refMassKg, referenceD) either, which shows up as a
// visible jump in the trace exactly at the panel 1/2 handoff even when the
// aircraft is at (or very near) the reference mass. So: always anchor the
// fit at that exact point, and drop any dragged point too close to it
// (it's almost certainly a same-but-imprecise attempt to mark the anchor).
export const MASS_ANCHOR_TOLERANCE_KG = 15;
function anchoredMassPoints(points: { x: number; y: number }[], referenceD: number) {
  return [{ x: TAKEOFF.refMassKg, y: referenceD }, ...points.filter((p) => Math.abs(p.x - TAKEOFF.refMassKg) > MASS_ANCHOR_TOLERANCE_KG)];
}

/**
 * The mass-correction panel's printed lines are all the same power-law
 * curve, just scaled by whichever reference distance each line represents
 * — so a single calibrated line (see `TakeoffCalibration.mass`) gives a
 * reusable factor curve, applied here to the actual `referenceM`. Falls
 * back to the reconstruction's `(mass/refMass)^exponent` formula when no
 * real points exist yet.
 */
export function massAdjustedDistanceM(referenceM: number, massKg: number, calibration: TakeoffCalibration = DEFAULT_TAKEOFF_CALIBRATION): number {
  const { points, referenceD } = calibration.mass;
  const factor = points.length > 0 ? lagrangeXY(anchoredMassPoints(points, referenceD), massKg) / referenceD : Math.pow(massKg / TAKEOFF.refMassKg, TAKEOFF.massExponent);
  return referenceM * factor;
}

export function takeoffSpeedKias(massKg: number): number {
  return 50 * Math.pow(massKg / TAKEOFF.refMassKg, TAKEOFF.speedExponent);
}

export type WindDirection = "head" | "tail";

// Same idea as the mass anchor above: every wind-correction line (head and
// tail alike) passes through (0 kt, its own d) by construction — that's
// the "Bezugslinie Windstille" reference line. Anchor the fit there and
// drop any dragged point too close to it, for the same reason.
export const WIND_ANCHOR_TOLERANCE_KT = 1.5;
function anchoredWindPoints(points: { x: number; y: number }[], referenceD: number) {
  return [{ x: 0, y: referenceD }, ...points.filter((p) => Math.abs(p.x) > WIND_ANCHOR_TOLERANCE_KT)];
}

/** Same reusable-factor-curve idea as `massAdjustedDistanceM`, but per wind direction (head/tail have visibly different curves on the real chart). */
export function windAdjustedTakeoffDistanceM(
  massDistanceM: number,
  windKt: number,
  speedKias: number,
  direction: WindDirection,
  calibration: TakeoffCalibration = DEFAULT_TAKEOFF_CALIBRATION,
): number {
  const refPoints = calibration.wind[direction];
  if (refPoints.length > 0) {
    return massDistanceM * (lagrangeXY(anchoredWindPoints(refPoints, calibration.wind.referenceD), windKt) / calibration.wind.referenceD);
  }
  const sign = direction === "tail" ? 1 : -1;
  return massDistanceM * (1 + (sign * TAKEOFF.windCoefficient * windKt) / speedKias);
}

export interface TakeoffResult {
  referenceDistanceM: number;
  massAdjustedDistanceM: number;
  speedKias: number;
  windAdjustedDistanceM: number;
}

export function computeTakeoff(
  pressureFt: number,
  tempC: number,
  massKg: number,
  windKt: number,
  direction: WindDirection,
  calibration: TakeoffCalibration = DEFAULT_TAKEOFF_CALIBRATION,
): TakeoffResult {
  const d1 = referenceDistanceM(pressureFt, tempC, calibration);
  const d2 = massAdjustedDistanceM(d1, massKg, calibration);
  const v = takeoffSpeedKias(massKg);
  const d3 = windAdjustedTakeoffDistanceM(d2, windKt, v, direction, calibration);
  return { referenceDistanceM: d1, massAdjustedDistanceM: d2, speedKias: v, windAdjustedDistanceM: d3 };
}

// ---------------------------------------------------------------------
// Landing — "Landestrecke"
// ---------------------------------------------------------------------

export const LANDING = Object.freeze({
  massKg: 1055, // this POH only charts landing at max weight
  refAltitudeFt: 2500,
  refTemperatureC: 24,
  refY: 601,
  ordinatePerC: 7.2,
  ordinatePer1000Ft: 75,
  referenceGroundM: 201,
  referenceObstacleM: 363,
  groundPerOrdinate: 0.088,
  obstaclePerOrdinate: 0.125,
  headwindGroundPerKt: 0.017,
  headwindObstaclePerKt: 0.012,
  tailwindGroundPerKt: 0.055,
  tailwindObstaclePerKt: 0.043,
  minPressureFt: 0,
  maxPressureFt: 8000,
  minTempC: -40,
  maxTempC: 40,
  maxHeadwindKt: 15,
  maxTailwindKt: 5, // the real chart only prints a demonstrated tailwind line up to 5 kt — see landingCorrectedDistanceM
  approachSpeedKias: 63,
});

/**
 * The reconstruction's original linear formula for the chart's internal
 * "ordinate" — exact only at the one worked example (2500 ft/24°C), same
 * caveat as `fallbackReferenceDistanceM` above. Kept as a fallback for
 * altitude lines with no real calibration yet.
 */
function fallbackLandingOrdinate(pressureFt: number, tempC: number): number {
  return LANDING.refY - LANDING.ordinatePerC * (tempC - LANDING.refTemperatureC) - (LANDING.ordinatePer1000Ft * (pressureFt - LANDING.refAltitudeFt)) / 1000;
}

// Same "same shape, different offset" approach as the takeoff altitude
// lines — see that comment above for the full reasoning.
function landingAltitudeOffsetFromFallback(pressureFt: number, anchorPressureFt: number): number {
  return fallbackLandingOrdinate(pressureFt, LANDING.refTemperatureC) - fallbackLandingOrdinate(anchorPressureFt, LANDING.refTemperatureC);
}

/**
 * The chart's internal "ordinate" value (not a real-world unit — it's
 * literally the SVG pixel y-coordinate `LandingNomogram` draws at) for a
 * given pressure altitude/OAT. Same real-data-first, offset-shifted,
 * formula-fallback approach as `referenceDistanceM` above; `calibration`
 * defaults to the committed JSON but can be overridden by the `?edit=true`
 * editor.
 */
export function landingChartY(pressureFt: number, tempC: number, calibration: LandingCalibration = DEFAULT_LANDING_CALIBRATION): number {
  const verifiedLines = calibration.lines.filter((l) => l.points.length > 0);
  if (verifiedLines.length === 0) return fallbackLandingOrdinate(pressureFt, tempC);

  const exact = verifiedLines.find((l) => l.pressureFt === pressureFt);
  if (exact) return lagrangeInterpolate(exact.points, tempC);

  const verifiedAltitudesFt = verifiedLines.map((l) => l.pressureFt).sort((a, b) => a - b);
  const lineAt = (p: number) => verifiedLines.find((l) => l.pressureFt === p)!.points;

  const lowerAlt = [...verifiedAltitudesFt].reverse().find((p) => p < pressureFt);
  const upperAlt = verifiedAltitudesFt.find((p) => p > pressureFt);
  if (lowerAlt !== undefined && upperAlt !== undefined) {
    const lowerVal = lagrangeInterpolate(lineAt(lowerAlt), tempC);
    const upperVal = lagrangeInterpolate(lineAt(upperAlt), tempC);
    return lerp(pressureFt, lowerAlt, upperAlt, lowerVal, upperVal);
  }

  const nearestAlt = [...verifiedAltitudesFt].sort((a, b) => Math.abs(a - pressureFt) - Math.abs(b - pressureFt))[0];
  const nearestShape = lagrangeInterpolate(lineAt(nearestAlt), tempC);
  return nearestShape + landingAltitudeOffsetFromFallback(pressureFt, nearestAlt);
}

function fallbackStillGroundM(y: number): number {
  return LANDING.referenceGroundM + LANDING.groundPerOrdinate * (LANDING.refY - y);
}

function fallbackStillObstacleM(y: number): number {
  return LANDING.referenceObstacleM + LANDING.obstaclePerOrdinate * (LANDING.refY - y);
}

// The chart's two demonstrated-wind reference lines aren't symmetric —
// the real scan only prints a tailwind line up to 5 kt, vs. 15 kt for
// headwind (see LANDING.maxTailwindKt above) — so the "max wind" each
// direction's reference line represents is looked up per-direction rather
// than assumed to be a shared constant.
function maxWindKt(direction: WindDirection): number {
  return direction === "tail" ? LANDING.maxTailwindKt : LANDING.maxHeadwindKt;
}

function fallbackMaxWindDistanceM(kind: "ground" | "obstacle", direction: WindDirection, y: number): number {
  const still = kind === "ground" ? fallbackStillGroundM(y) : fallbackStillObstacleM(y);
  const perKt =
    direction === "tail"
      ? kind === "ground"
        ? LANDING.tailwindGroundPerKt
        : LANDING.tailwindObstaclePerKt
      : kind === "ground"
        ? LANDING.headwindGroundPerKt
        : LANDING.headwindObstaclePerKt;
  const kt = maxWindKt(direction);
  return direction === "tail" ? still * (1 + perKt * kt) : still * (1 - perKt * kt);
}

function correctionLineValue(
  kind: "ground" | "obstacle",
  variant: "still" | "head" | "tail",
  y: number,
  calibration: LandingCalibration,
): number | null {
  const points = calibration.corrections[kind][variant];
  return points.length > 0 ? lagrangeXY(points, y) : null;
}

/**
 * Panel 2's windstill ("0 kt") line — real-data-first (same pattern as
 * `landingChartY` above), falling back to the reconstruction's linear
 * formula where no real points are calibrated yet.
 */
export function stillGroundM(y: number, calibration: LandingCalibration = DEFAULT_LANDING_CALIBRATION): number {
  return correctionLineValue("ground", "still", y, calibration) ?? fallbackStillGroundM(y);
}

export function stillObstacleM(y: number, calibration: LandingCalibration = DEFAULT_LANDING_CALIBRATION): number {
  return correctionLineValue("obstacle", "still", y, calibration) ?? fallbackStillObstacleM(y);
}

/**
 * Panel 2 only prints 3 lines per distance kind — windstill, max
 * demonstrated headwind, max demonstrated tailwind — each calibrated
 * independently (real points, Lagrange-fit, formula fallback) rather than
 * assumed to be scaled copies of one another. Intermediate wind speeds
 * interpolate linearly between the windstill line and whichever direction's
 * reference line matches, scaled by that direction's own max (head and
 * tail aren't printed at the same wind speed — see `maxWindKt` above).
 */
export function landingCorrectedDistanceM(
  kind: "ground" | "obstacle",
  y: number,
  windKt: number,
  direction: WindDirection,
  calibration: LandingCalibration = DEFAULT_LANDING_CALIBRATION,
): number {
  const still = kind === "ground" ? stillGroundM(y, calibration) : stillObstacleM(y, calibration);
  if (windKt <= 0) return still;
  const variant = direction === "tail" ? "tail" : "head";
  const atMaxWind = correctionLineValue(kind, variant, y, calibration) ?? fallbackMaxWindDistanceM(kind, direction, y);
  return lerp(windKt, 0, maxWindKt(direction), still, atMaxWind);
}

export interface LandingResult {
  y: number;
  stillGroundM: number;
  stillObstacleM: number;
  groundM: number;
  obstacleM: number;
}

export function computeLanding(
  pressureFt: number,
  tempC: number,
  windKt: number,
  direction: WindDirection,
  calibration: LandingCalibration = DEFAULT_LANDING_CALIBRATION,
): LandingResult {
  const y = landingChartY(pressureFt, tempC, calibration);
  const sg = stillGroundM(y, calibration);
  const so = stillObstacleM(y, calibration);
  return {
    y,
    stillGroundM: sg,
    stillObstacleM: so,
    groundM: landingCorrectedDistanceM("ground", y, windKt, direction, calibration),
    obstacleM: landingCorrectedDistanceM("obstacle", y, windKt, direction, calibration),
  };
}
