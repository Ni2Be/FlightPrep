/**
 * Standard-atmosphere helpers. These are the textbook formulas (ICAO
 * Standard Atmosphere), not placeholder data.
 */

/** Pressure altitude from field elevation and the current QNH (hPa). ~27 ft per hPa below 1013.25. */
export function pressureAltitudeFt(elevationFt: number, qnhHpa: number): number {
  return elevationFt + (1013.25 - qnhHpa) * 27;
}

/** ISA temperature at a given pressure altitude (2°C lapse per 1000 ft from 15°C at sea level). */
export function isaTemperatureC(pressureAltitudeFtValue: number): number {
  return 15 - (pressureAltitudeFtValue / 1000) * 2;
}

/** Density altitude from pressure altitude and actual OAT (120 ft per °C deviation from ISA). */
export function densityAltitudeFt(pressureAltitudeFtValue: number, oatC: number): number {
  const isaDeviation = oatC - isaTemperatureC(pressureAltitudeFtValue);
  return pressureAltitudeFtValue + 120 * isaDeviation;
}
