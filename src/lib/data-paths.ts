/**
 * Builds a URL to a committed snapshot file under /public/data, respecting
 * the GitHub Pages basePath (set via next.config.ts's NEXT_PUBLIC_BASE_PATH
 * env var; empty string locally).
 */
export function dataUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function weatherDataUrl(icao: string): string {
  return dataUrl(`/data/${icao}/weather.json`);
}

/** Build-time flag — true only in the "hosted" build, where /api/notams exists. */
export const HOSTED_MODE = process.env.NEXT_PUBLIC_HOSTED_MODE === "true";

export function notamsApiUrl(icao: string): string {
  return dataUrl(`/api/notams?icao=${encodeURIComponent(icao)}`);
}

export function weatherApiUrl(icao: string): string {
  return dataUrl(`/api/weather?icao=${encodeURIComponent(icao)}`);
}

export function referenceChartUrl(id: string): string {
  return dataUrl(`/api/reference-chart?id=${encodeURIComponent(id)}`);
}
