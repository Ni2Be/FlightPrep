import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

// Serves scanned POH chart images for the "original scan instead of
// vectors" toggle in TakeoffNomogram/LandingNomogram — hosted mode only,
// and reads from /reference-charts
// at the repo root, which is gitignored and never part of the public
// static export. These are copyrighted manual pages; this route exists so
// you can visually verify the digitized chart against the original on your
// own machine, not to publish them anywhere.
const REFERENCE_CHARTS_DIR = path.join(process.cwd(), "reference-charts");
const ID_PATTERN = /^[a-z0-9-]+$/;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Missing or invalid ?id=." }, { status: 400 });
  }

  try {
    const filePath = path.join(REFERENCE_CHARTS_DIR, `${id}.png`);
    const buffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: `No local reference-charts/${id}.png found.` }, { status: 404 });
  }
}
