import type { CloudLayer, MetarData } from "../metar";

// Server-only (see src/app/api/weather/route.ts). Fetches the live on-field
// weather observation for EDKA from https://www.wetter-edka.de/ — a
// privately-run AWS at the airfield itself. TS counterpart of
// scripts/fetchers/wetter-edka.mjs; keep both in sync. See that file for
// notes on the page format.
const URL = "https://www.wetter-edka.de/";
const SOURCE_LABEL = "wetter-edka.de (on-field AWS, unofficial)";

interface WetterEdkaResult {
  ok: boolean;
  error: string | null;
  metar: MetarData | null;
}

function metersToSM(meters: number): number {
  return Math.round((meters / 1609.34) * 10) / 10;
}

function parseRawMetarTokens(raw: string) {
  const tokens = raw.trim().split(/\s+/);
  let windDirDeg: number | "VRB" | null = null;
  let windSpeedKt: number | null = null;
  let windGustKt: number | null = null;
  let visibilitySM: number | null = null;
  let tempC: number | null = null;
  let dewpointC: number | null = null;
  let altimeterHpa: number | null = null;
  const clouds: CloudLayer[] = [];

  for (const token of tokens) {
    let m: RegExpMatchArray | null;
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
  }

  return { windDirDeg, windSpeedKt, windGustKt, visibilitySM, tempC, dewpointC, altimeterHpa, clouds };
}

export async function fetchWetterEdka(): Promise<WetterEdkaResult> {
  try {
    const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FlightPrep/1.0)" } });
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
    const metar: MetarData = { raw, obsTime, source: SOURCE_LABEL, flightCategory: null, ...parsed };

    return { ok: true, error: null, metar };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), metar: null };
  }
}
