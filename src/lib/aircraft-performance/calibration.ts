/**
 * Generic, aircraft-agnostic pieces of the chart-calibration model — shared
 * between a chart's normal rendering/calculation and its `?edit=true`
 * calibration editor. See CalibrationPanel.tsx and TakeoffNomogram.tsx for
 * how these get used, and pa28-161-cadet.calibration.json for the shape
 * this is meant to describe.
 */

/** Two (value, pixel) anchors define a linear px<->value mapping for one axis. */
export interface AxisCalibration {
  valueA: number;
  pxA: number;
  valueB: number;
  pxB: number;
}

export interface LinePoint {
  tempC: number;
  distanceM: number;
}

export interface CalibratedLine {
  pressureFt: number;
  /** Real points read off the scan for this line — empty until calibrated. */
  points: LinePoint[];
}

export interface XYPoint {
  x: number;
  y: number;
}

/**
 * The mass- and wind-correction panels are families of lines that are all
 * the *same* power-law curve, just scaled by a reference distance (`d`) —
 * unlike the pressure-altitude panel, where each line genuinely has its own
 * shape. So rather than calibrating all ~15 printed lines per panel
 * individually, you calibrate real (value, distanceM) points on *one*
 * printed reference line (`referenceD`); dividing by `referenceD` gives a
 * reusable correction *factor* curve that's then applied to every other
 * line (and to the actual calculation) at whatever distance it needs.
 */
export interface FactorCalibration {
  referenceD: number;
  points: XYPoint[];
}

export type TakeoffAxisName = "temp" | "distance" | "mass" | "wind";

export interface TakeoffCalibration {
  axes: Record<TakeoffAxisName, AxisCalibration>;
  lines: CalibratedLine[];
  mass: FactorCalibration;
  wind: { referenceD: number; head: XYPoint[]; tail: XYPoint[] };
}

export function scaleValueToPx(axis: AxisCalibration): (value: number) => number {
  return (value) => axis.pxA + ((value - axis.valueA) / (axis.valueB - axis.valueA)) * (axis.pxB - axis.pxA);
}

export function scalePxToValue(axis: AxisCalibration): (px: number) => number {
  return (px) => axis.valueA + ((px - axis.pxA) / (axis.pxB - axis.pxA)) * (axis.valueB - axis.valueA);
}

/**
 * Fits the unique polynomial of degree (points.length - 1) through real
 * (x, y) readings via Lagrange interpolation — a straight line for 2
 * points, a parabola for 3, etc. — rather than connecting them with
 * straight segments. Confirmed necessary for the pressure-altitude lines
 * by reading 3 points off the real chart: a chord between the endpoints
 * missed the middle point by ~11 m. Only safe to extrapolate modestly
 * beyond the given points; Lagrange polynomials can swing wildly further
 * out, especially with many points.
 */
export function lagrangeXY(points: XYPoint[], x: number): number {
  let result = 0;
  for (let i = 0; i < points.length; i++) {
    let term = points[i].y;
    for (let j = 0; j < points.length; j++) {
      if (j !== i) term *= (x - points[j].x) / (points[i].x - points[j].x);
    }
    result += term;
  }
  return result;
}

export function lagrangeInterpolate(points: LinePoint[], tempC: number): number {
  return lagrangeXY(
    points.map((p) => ({ x: p.tempC, y: p.distanceM })),
    tempC,
  );
}

// --- Immutable calibration-editing helpers, used by the `?edit=true` editor ---

export function withAxisPx(calibration: TakeoffCalibration, axis: TakeoffAxisName, which: "pxA" | "pxB", px: number): TakeoffCalibration {
  return { ...calibration, axes: { ...calibration.axes, [axis]: { ...calibration.axes[axis], [which]: px } } };
}

export function withLinePoint(calibration: TakeoffCalibration, pressureFt: number, index: number, point: LinePoint): TakeoffCalibration {
  return {
    ...calibration,
    lines: calibration.lines.map((l) => (l.pressureFt === pressureFt ? { ...l, points: l.points.map((p, i) => (i === index ? point : p)) } : l)),
  };
}

export function withAddedLinePoint(calibration: TakeoffCalibration, pressureFt: number, point: LinePoint): TakeoffCalibration {
  return {
    ...calibration,
    lines: calibration.lines.map((l) => (l.pressureFt === pressureFt ? { ...l, points: [...l.points, point] } : l)),
  };
}

export function withRemovedLinePoint(calibration: TakeoffCalibration, pressureFt: number, index: number): TakeoffCalibration {
  return {
    ...calibration,
    lines: calibration.lines.map((l) => (l.pressureFt === pressureFt ? { ...l, points: l.points.filter((_, i) => i !== index) } : l)),
  };
}

export function withMassPoint(calibration: TakeoffCalibration, index: number | null, point: XYPoint): TakeoffCalibration {
  const points = index === null ? [...calibration.mass.points, point] : calibration.mass.points.map((p, i) => (i === index ? point : p));
  return { ...calibration, mass: { ...calibration.mass, points } };
}

export function withRemovedMassPoint(calibration: TakeoffCalibration, index: number): TakeoffCalibration {
  return { ...calibration, mass: { ...calibration.mass, points: calibration.mass.points.filter((_, i) => i !== index) } };
}

export function withWindPoint(calibration: TakeoffCalibration, direction: "head" | "tail", index: number | null, point: XYPoint): TakeoffCalibration {
  const existing = calibration.wind[direction];
  const points = index === null ? [...existing, point] : existing.map((p, i) => (i === index ? point : p));
  return { ...calibration, wind: { ...calibration.wind, [direction]: points } };
}

export function withRemovedWindPoint(calibration: TakeoffCalibration, direction: "head" | "tail", index: number): TakeoffCalibration {
  return { ...calibration, wind: { ...calibration.wind, [direction]: calibration.wind[direction].filter((_, i) => i !== index) } };
}

// --- Landing chart ---
//
// Panel 1 (pressure-altitude) works the same way as takeoff: per-altitude-
// line real points, Lagrange-fit, formula fallback. Panel 2 (wind
// correction) prints 3 lines per distance kind — windstill, 15 kt head, 15
// kt tail — each independently calibratable the same way (real (y,
// distanceM) points, Lagrange-fit, formula fallback); intermediate wind
// speeds interpolate between the windstill and 15-kt line rather than
// assuming they're scaled copies of each other (see
// `landingCorrectedDistanceM` in pa28-161-cadet.ts).

export type LandingAxisName = "temp" | "distance";
export type LandingCorrectionKind = "ground" | "obstacle";
export type LandingCorrectionVariant = "still" | "head" | "tail";

export interface LandingCalibration {
  axes: Record<LandingAxisName, AxisCalibration>;
  /**
   * Same shape as takeoff's `lines`, but `distanceM` here actually holds
   * the chart's internal "ordinate" value (what `landingChartY` computes),
   * not a real distance — see that function's doc comment.
   */
  lines: CalibratedLine[];
  /**
   * Panel 2's 3 printed lines per distance kind. Each point is
   * `{x: ordinateY, y: distanceM}` — x is the raw shared pixel y-coordinate
   * (same convention as `lines[].points[].distanceM` above), y is the real
   * distance in meters read off panel 2's (calibratable) x-axis.
   */
  corrections: Record<LandingCorrectionKind, Record<LandingCorrectionVariant, XYPoint[]>>;
}

export function withLandingAxisPx(calibration: LandingCalibration, axis: LandingAxisName, which: "pxA" | "pxB", px: number): LandingCalibration {
  return { ...calibration, axes: { ...calibration.axes, [axis]: { ...calibration.axes[axis], [which]: px } } };
}

export function withLandingLinePoint(calibration: LandingCalibration, pressureFt: number, index: number, point: LinePoint): LandingCalibration {
  return {
    ...calibration,
    lines: calibration.lines.map((l) => (l.pressureFt === pressureFt ? { ...l, points: l.points.map((p, i) => (i === index ? point : p)) } : l)),
  };
}

export function withAddedLandingLinePoint(calibration: LandingCalibration, pressureFt: number, point: LinePoint): LandingCalibration {
  return {
    ...calibration,
    lines: calibration.lines.map((l) => (l.pressureFt === pressureFt ? { ...l, points: [...l.points, point] } : l)),
  };
}

export function withRemovedLandingLinePoint(calibration: LandingCalibration, pressureFt: number, index: number): LandingCalibration {
  return {
    ...calibration,
    lines: calibration.lines.map((l) => (l.pressureFt === pressureFt ? { ...l, points: l.points.filter((_, i) => i !== index) } : l)),
  };
}

export function withLandingCorrectionPoint(
  calibration: LandingCalibration,
  kind: LandingCorrectionKind,
  variant: LandingCorrectionVariant,
  index: number,
  point: XYPoint,
): LandingCalibration {
  return {
    ...calibration,
    corrections: {
      ...calibration.corrections,
      [kind]: { ...calibration.corrections[kind], [variant]: calibration.corrections[kind][variant].map((p, i) => (i === index ? point : p)) },
    },
  };
}

export function withAddedLandingCorrectionPoint(
  calibration: LandingCalibration,
  kind: LandingCorrectionKind,
  variant: LandingCorrectionVariant,
  point: XYPoint,
): LandingCalibration {
  return {
    ...calibration,
    corrections: {
      ...calibration.corrections,
      [kind]: { ...calibration.corrections[kind], [variant]: [...calibration.corrections[kind][variant], point] },
    },
  };
}

export function withRemovedLandingCorrectionPoint(
  calibration: LandingCalibration,
  kind: LandingCorrectionKind,
  variant: LandingCorrectionVariant,
  index: number,
): LandingCalibration {
  return {
    ...calibration,
    corrections: {
      ...calibration.corrections,
      [kind]: { ...calibration.corrections[kind], [variant]: calibration.corrections[kind][variant].filter((_, i) => i !== index) },
    },
  };
}
