#!/usr/bin/env node
// Entry point for the scheduled data refresh (.github/workflows/refresh-data.yml).
// Runs server-side (Node, not the browser) so it isn't subject to the CORS
// restrictions that block calling aviationweather.gov directly from client JS.
//
// Weather only — NOTAMs need a logged-in DFS session and are fetched on
// demand from the "hosted mode" API route instead (src/app/api/notams,
// src/lib/dfs-notams.ts). See README.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWeather } from "./fetchers/weather.mjs";
import { fetchWetterEdka } from "./fetchers/wetter-edka.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DATA_DIR = path.join(__dirname, "..", "public", "data");

// Airports to refresh. Keep this in sync with src/data/airports/index.ts —
// when you add a new airport there, add its ICAO (and weather station ICAO,
// if it has no automated station of its own) here too. `localMetarSource:
// "wetter-edka"` means: use that dedicated on-field station for *current
// conditions*, but still pull the TAF *forecast* from weatherStationIcao
// (wetter-edka.de is observation-only).
const AIRPORTS = [{ icao: "EDKA", weatherStationIcao: "EHBK", localMetarSource: "wetter-edka" }];

async function fetchAirportWeather(airport) {
  const aviationWeather = await fetchWeather(airport.weatherStationIcao);

  if (airport.localMetarSource === "wetter-edka") {
    const local = await fetchWetterEdka();
    return {
      icao: airport.icao,
      fetchedAt: new Date().toISOString(),
      ok: local.ok || aviationWeather.ok,
      error: local.error,
      metar: local.metar ?? aviationWeather.metar,
      taf: aviationWeather.taf,
    };
  }

  return {
    icao: airport.icao,
    fetchedAt: new Date().toISOString(),
    ok: aviationWeather.ok,
    error: aviationWeather.error,
    metar: aviationWeather.metar,
    taf: aviationWeather.taf,
  };
}

async function run() {
  for (const airport of AIRPORTS) {
    const dir = path.join(PUBLIC_DATA_DIR, airport.icao);
    await mkdir(dir, { recursive: true });

    console.log(`[${airport.icao}] fetching weather...`);
    const weather = await fetchAirportWeather(airport);
    await writeFile(path.join(dir, "weather.json"), JSON.stringify(weather, null, 2) + "\n");
  }
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
