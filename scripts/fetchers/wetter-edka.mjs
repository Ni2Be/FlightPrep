// Fetches the live on-field weather observation for EDKA (Aachen-Merzbrück)
// from https://www.wetter-edka.de/ — a privately-run automated weather
// station at the airfield itself, which is better than any official
// station nearby since it's actually ON the field (EDKA has no ICAO
// station of its own). The page is plain server-rendered HTML (refreshed
// every 3 min via <meta http-equiv="Refresh">) embedding a METAR-formatted
// string like:
//   [ EDKA 031120Z AUTO 02005KT 340V050 9999 ///////// 19/13 Q1030 ]
// There's no TAF here — this is observation-only, so callers should still
// get a forecast from a real aviation station (see fetchers/weather.mjs).
const URL = "https://www.wetter-edka.de/";
const SOURCE_LABEL = "wetter-edka.de (on-field AWS, unofficial)";
const USER_AGENT = "Mozilla/5.0 (compatible; FlightPrep/1.0)";

function metersToSM(meters) {
  return Math.round((meters / 1609.34) * 10) / 10;
}

/** Token-by-token METAR decoder — deliberately minimal, just the fields this app uses. */
function parseRawMetarTokens(raw) {
  const tokens = raw.trim().split(/\s+/);
  let windDirDeg = null;
  let windSpeedKt = null;
  let windGustKt = null;
  let visibilitySM = null;
  let tempC = null;
  let dewpointC = null;
  let altimeterHpa = null;
  const clouds = [];

  for (const token of tokens) {
    let m;
    if ((m = token.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/))) {
      windDirDeg = m[1] === "VRB" ? "VRB" : Number(m[1]);
      windSpeedKt = Number(m[2]);
      windGustKt = m[3] ? Number(m[3]) : null;
    } else if (token === "CAVOK") {
      visibilitySM = 10;
    } else if ((m = token.match(/^(\d{4})$/))) {
      const meters = Number(m[1]);
      visibilitySM = meters >= 9999 ? 10 : metersToSM(meters);
    } else if ((m = token.match(/^(FEW|SCT|BKN|OVC)(\d{3})$/))) {
      clouds.push({ cover: m[1], baseFt: Number(m[2]) * 100 });
    } else if ((m = token.match(/^(M?\d{2})\/(M?\d{2})$/))) {
      tempC = Number(m[1].replace("M", "-"));
      dewpointC = Number(m[2].replace("M", "-"));
    } else if ((m = token.match(/^Q(\d{4})$/))) {
      altimeterHpa = Number(m[1]);
    }
    // Anything else (variable-wind group, RVR, weather phenomena, the
    // "/////////" unreported-cloud placeholder) is intentionally skipped.
  }

  return { windDirDeg, windSpeedKt, windGustKt, visibilitySM, tempC, dewpointC, altimeterHpa, clouds };
}

export async function fetchWetterEdka() {
  try {
    const res = await fetch(URL, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const bracketMatch = html.match(/\[\s*([A-Z]{4}\s+\d{6}Z[\s\S]*?)\s*\]/);
    if (!bracketMatch) {
      throw new Error("Couldn't find the METAR line on wetter-edka.de — page layout may have changed.");
    }
    const raw = bracketMatch[1].replace(/\s+/g, " ").trim();

    const dateMatch = html.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\s*UTC/);
    const obsTime = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:00.000Z`
      : new Date().toISOString();

    const parsed = parseRawMetarTokens(raw);
    const metar = { raw, obsTime, source: SOURCE_LABEL, flightCategory: null, ...parsed };

    return { ok: true, error: null, metar };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), metar: null };
  }
}
