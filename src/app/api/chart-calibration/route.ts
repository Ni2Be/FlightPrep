import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

// Hosted-mode only (this route doesn't exist in the static export, same as
// /api/reference-chart and /api/weather). Writes the `?edit=true` editor's
// output straight into the committed calibration file — this is a local
// personal dev tool, not something exposed on the public site, so there's
// no auth beyond "hosted mode is running at all".
const CALIBRATION_DIR = path.join(process.cwd(), "src", "data", "aircraft-performance");
const ALLOWED = new Set(["pa28-161-cadet"]);
const ID_PATTERN = /^[a-z0-9-]+$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const aircraft = body?.aircraft;
  const chart = body?.chart;
  const calibration = body?.calibration;

  if (typeof aircraft !== "string" || !ID_PATTERN.test(aircraft) || !ALLOWED.has(aircraft)) {
    return NextResponse.json({ error: "Unknown or invalid aircraft id." }, { status: 400 });
  }
  if (chart !== "takeoff" && chart !== "landing") {
    return NextResponse.json({ error: 'chart must be "takeoff" or "landing".' }, { status: 400 });
  }
  if (typeof calibration !== "object" || calibration === null) {
    return NextResponse.json({ error: "Missing calibration object." }, { status: 400 });
  }

  const filePath = path.join(CALIBRATION_DIR, `${aircraft}.calibration.json`);

  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    // No existing file yet — start fresh.
  }

  const next = { ...existing, [chart]: calibration };
  await writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");

  return NextResponse.json({ ok: true, path: `src/data/aircraft-performance/${aircraft}.calibration.json` });
}
