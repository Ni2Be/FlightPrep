import { NextRequest, NextResponse } from "next/server";
import { AIRPORTS } from "@/data/airports";
import { fetchAirportWeatherLive } from "@/lib/weather-fetch";

// Hosted-mode only — same reasoning as src/app/api/notams: this needs to
// run server-side (aviationweather.gov disallows CORS; wetter-edka.de has
// no reason to either), so it can't be part of the static GitHub Pages
// export. See next.config.ts / scripts/build-static.mjs.
export async function GET(request: NextRequest) {
  const icao = request.nextUrl.searchParams.get("icao")?.toUpperCase();
  const airport = icao ? AIRPORTS[icao] : undefined;

  if (!airport) {
    return NextResponse.json({ error: "Missing or unknown ?icao= query param." }, { status: 400 });
  }

  const result = await fetchAirportWeatherLive(airport);
  return NextResponse.json(result);
}
