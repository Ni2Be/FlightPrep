import type { WeatherSnapshot } from "./metar";
import type { Airport } from "@/data/airports/types";
import { fetchAviationWeather } from "./sources/aviationweather";
import { fetchWetterEdka } from "./sources/wetter-edka";

// Server-only — used by src/app/api/weather/route.ts (hosted mode) to fetch
// weather live, the same way scripts/fetch-data.mjs does for the static
// snapshot. Keep the per-airport source selection in sync with that script.
export async function fetchAirportWeatherLive(airport: Airport): Promise<WeatherSnapshot> {
  const aviationWeather = await fetchAviationWeather(airport.weatherStationIcao);

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
