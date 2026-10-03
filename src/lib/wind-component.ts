export interface WindComponents {
  /** Positive = headwind, negative = tailwind, along the runway centerline. */
  headwindKt: number;
  /** Positive = from the right of the runway heading, negative = from the left. */
  crosswindKt: number;
  /** Signed angle between wind and runway heading, -180..180. */
  angleDeg: number;
}

/**
 * Resolves a wind direction/speed into head/crosswind components for one
 * runway heading. Both headings must be in the same reference (true or
 * magnetic) — METAR wind is reported true, runway idents are magnetic, so
 * convert one before calling this (see `trueToMagnetic`/`magneticToTrue`).
 */
export function windComponents(windDirDeg: number, windSpeedKt: number, runwayHeadingDeg: number): WindComponents {
  // Normalize (windDir - runwayHeading) into -180..180. Wind FROM the runway
  // heading (angle 0) is a straight headwind; wind from the right (+90) is a
  // pure right crosswind.
  const angle = ((((windDirDeg - runwayHeadingDeg) % 360) + 540) % 360) - 180;
  const rad = (angle * Math.PI) / 180;
  return {
    headwindKt: windSpeedKt * Math.cos(rad),
    crosswindKt: windSpeedKt * Math.sin(rad),
    angleDeg: angle,
  };
}

export function magneticToTrue(magneticDeg: number, variationDegEast: number): number {
  return (magneticDeg + variationDegEast + 360) % 360;
}

export function trueToMagnetic(trueDeg: number, variationDegEast: number): number {
  return (trueDeg - variationDegEast + 360) % 360;
}
