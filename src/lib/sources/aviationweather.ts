import type { CloudLayer, MetarData, TafData } from "../metar";

// Server-only (see src/app/api/weather/route.ts) — aviationweather.gov's
// docs say CORS isn't permitted, so this can't run from the browser.
// TS counterpart of scripts/fetchers/weather.mjs; keep both in sync.
const AVIATIONWEATHER_URL = "https://aviationweather.gov/api/data/metar";
const SOURCE_LABEL = "aviationweather.gov Data API";

interface AviationWeatherResult {
  ok: boolean;
  error: string | null;
  metar: MetarData | null;
  taf: TafData | null;
}

function parseVisibility(visib: unknown): number | null {
  if (visib == null) return null;
  if (typeof visib === "number") return visib;
  const match = String(visib).match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

function parseClouds(rawClouds: unknown): CloudLayer[] {
  if (!Array.isArray(rawClouds)) return [];
  return rawClouds.map((c) => ({
    cover: c.cover,
    baseFt: typeof c.base === "number" ? c.base : null,
  }));
}

export async function fetchAviationWeather(stationIcao: string): Promise<AviationWeatherResult> {
  const url = `${AVIATIONWEATHER_URL}?ids=${encodeURIComponent(stationIcao)}&format=json&taf=true`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const latest = Array.isArray(data) ? data[0] : null;

    if (!latest) {
      return { ok: false, error: `No METAR returned for ${stationIcao}.`, metar: null, taf: null };
    }

    const metar: MetarData = {
      raw: latest.rawOb ?? "",
      obsTime: latest.reportTime ?? new Date().toISOString(),
      source: `${SOURCE_LABEL} (${stationIcao})`,
      tempC: typeof latest.temp === "number" ? latest.temp : null,
      dewpointC: typeof latest.dewp === "number" ? latest.dewp : null,
      windDirDeg: latest.wdir === "VRB" ? "VRB" : typeof latest.wdir === "number" ? latest.wdir : null,
      windSpeedKt: typeof latest.wspd === "number" ? latest.wspd : null,
      windGustKt: typeof latest.wgst === "number" ? latest.wgst : null,
      visibilitySM: parseVisibility(latest.visib),
      altimeterHpa: typeof latest.altim === "number" ? latest.altim : null,
      flightCategory: latest.fltCat ?? null,
      clouds: parseClouds(latest.clouds),
    };

    const taf: TafData | null = latest.rawTaf ? { raw: latest.rawTaf, source: `${SOURCE_LABEL} (${stationIcao})` } : null;

    return { ok: true, error: null, metar, taf };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), metar: null, taf: null };
  }
}
