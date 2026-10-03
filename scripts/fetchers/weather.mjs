// Fetches METAR + TAF from NOAA's aviationweather.gov Data API.
//
// This API covers worldwide stations for free with no API key, but its docs
// explicitly say CORS is not permitted — so this can only run server-side
// (here, in a GitHub Actions runner, or from the hosted-mode API route),
// never directly from the browser.
const AVIATIONWEATHER_URL = "https://aviationweather.gov/api/data/metar";
const SOURCE_LABEL = "aviationweather.gov Data API";

function parseVisibility(visib) {
  if (visib == null) return null;
  if (typeof visib === "number") return visib;
  // The API returns strings like "6+" for visibility at/above the max reportable value.
  const match = String(visib).match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

function parseClouds(rawClouds) {
  if (!Array.isArray(rawClouds)) return [];
  return rawClouds.map((c) => ({
    cover: c.cover,
    baseFt: typeof c.base === "number" ? c.base : null,
  }));
}

/**
 * Fetches both METAR and TAF for a station. Returns `{ ok, error, metar, taf }`
 * — each of `metar`/`taf` carries its own `source` label so callers can mix
 * this with another METAR source (see fetchers/wetter-edka.mjs) and still
 * show correct attribution.
 * @param {string} stationIcao
 */
export async function fetchWeather(stationIcao) {
  const url = `${AVIATIONWEATHER_URL}?ids=${encodeURIComponent(stationIcao)}&format=json&taf=true`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const latest = Array.isArray(data) ? data[0] : null;

    if (!latest) {
      return { ok: false, error: `No METAR returned for ${stationIcao}.`, metar: null, taf: null };
    }

    const metar = {
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

    const taf = latest.rawTaf ? { raw: latest.rawTaf, source: `${SOURCE_LABEL} (${stationIcao})` } : null;

    return { ok: true, error: null, metar, taf };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), metar: null, taf: null };
  }
}
