import { NextRequest, NextResponse } from "next/server";
import { fetchNotams } from "@/lib/dfs-notams";

// Hosted-mode only — this route can't exist in the static GitHub Pages
// export (no server to run it on), which is why `npm run build:pages`
// temporarily removes src/app/api before building. See next.config.ts.
export async function GET(request: NextRequest) {
  const icao = request.nextUrl.searchParams.get("icao");
  if (!icao) {
    return NextResponse.json({ error: "Missing required ?icao= query param." }, { status: 400 });
  }

  const result = await fetchNotams(icao.toUpperCase());
  return NextResponse.json(result);
}
