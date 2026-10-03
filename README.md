# FlightPrep

A personal flight-preparation dashboard: weather, NOTAMs, and takeoff/landing
performance, built as a Next.js app that ships in two modes from one
codebase — a static export for GitHub Pages, and an optional "hosted" build
with a live NOTAM lookup.

Live (static) at: https://ni2be.github.io/FlightPrep/

## What it does

- **Weather** — METAR + TAF, with the standard VFR/MVFR/IFR/LIFR
  flight-category coloring. For EDKA specifically, current conditions come
  from [wetter-edka.de](https://www.wetter-edka.de/) — a privately-run
  automated station actually on the airfield (EDKA has no official ICAO
  station) — while the TAF forecast still comes from the nearest official
  aerodrome. Loads the last scheduled snapshot by default in both modes,
  plus a "Fetch live" button in **hosted mode** that bypasses the snapshot
  entirely and fetches both sources fresh, right now.
- **NOTAMs** — a "Fetch NOTAMs" button that logs into DFS's
  [ais.dfs.de PilotService](https://ais.dfs.de/pilotservice/briefing/notam/notam_edit_text.jsp)
  and fetches a live briefing. **Hosted mode only** — see
  [Modes](#modes--live-data) below. On the static GitHub Pages build the
  panel just says so and links to the official briefing source instead.
- **Performance** — takeoff/landing distance calculator for the Piper
  PA-28-161 Cadet, rendered as a full interactive nomogram (pressure
  altitude/OAT → mass → wind for takeoff; pressure altitude/OAT → wind for
  landing) with a dashed red trace line, exactly reproducing the layout of
  the two scanned POH chart pages — including a toggle to show the actual
  scan instead of the vector drawing, so you can check the trace against
  the original. See `src/lib/aircraft-performance/pa28-161-cadet.ts` for
  exactly how faithful the underlying model is. Works in both modes (the
  scan toggle needs hosted mode — see below).
- **Calibration editor** (`?edit=true`, hosted mode, takeoff chart only for
  now) — drag the axis anchors and each pressure-altitude line's control
  points directly on top of the scanned chart until the vector curves match
  it, then copy the resulting JSON into chat or save it straight to
  `src/data/aircraft-performance/pa28-161-cadet.calibration.json`. See
  [Calibrating a chart](#calibrating-a-chart) below.
- **Airport info** — runway/frequency/elevation reference data plus a short
  paraphrased summary of local procedures.
- Airports and aircraft are both pluggable — see [Adding an airport](#adding-an-airport-or-aircraft).

## Modes & live data

GitHub Pages is a static host with no server, which creates a real tension
for live data — handled a little differently for weather vs. NOTAMs:

- **Weather** doesn't need a session, but both of its sources (wetter-edka.de,
  and `aviationweather.gov` for TAF — whose docs explicitly disallow CORS)
  can't be called directly from the browser. A **scheduled GitHub Action**
  (`.github/workflows/refresh-data.yml`, every 30 min) fetches both
  server-side and commits the result as static JSON under
  `public/data/<ICAO>/`. That commit triggers the deploy workflow, so the
  published site is never more than one refresh cycle stale. This snapshot
  loads by default in **both** modes; hosted mode additionally gets a "Fetch
  live" button (`/api/weather`) that re-fetches both sources on the spot,
  same code path as the scheduled job (`src/lib/weather-fetch.ts` /
  `src/lib/sources/*`, mirrored in plain JS for the Action in
  `scripts/fetchers/*.mjs` — keep both in sync if you change the parsing).
- **NOTAMs** need an authenticated DFS session (confirmed by testing — an
  anonymous request gets redirected to their login page) fetched *at request
  time*, which a static site fundamentally can't do. So instead of baking
  NOTAMs into the scheduled snapshot, `src/app/api/notams/route.ts` is a
  Next.js Route Handler that logs in and fetches live, on demand, when you
  click the button — but that only exists in a **hosted** build (one with an
  actual running server):

  ```bash
  npm run build:pages   # static export for GitHub Pages — no /api routes
  npm run build          # normal Next.js build — /api/notams works
  npm run dev            # dev server — /api/notams works
  ```

  `next.config.ts` only sets `output: "export"` when `GITHUB_PAGES=true`
  (which `build:pages` sets for you, after temporarily moving `src/app/api`
  out of the way — Next.js hard-fails a static export if any dynamic Route
  Handler is present). A build-time flag (`NEXT_PUBLIC_HOSTED_MODE`) tells
  `NotamPanel` which mode it's in.

  To actually fetch NOTAMs in hosted mode, you need a free DFS AIS
  PilotService account:
  1. Register at https://ais.dfs.de/pilotservice/user/register/register_edit.jsp
     (just contact details — no pilot license required).
  2. Copy `.env.example` to `.env.local` and fill in `DFS_USERNAME`/`DFS_PASSWORD`
     (Next.js loads `.env.local` automatically; it's gitignored).
  3. Wherever you actually run the hosted build long-term, set the same two
     env vars there.

  Without those two env vars set, `/api/notams` just reports so and the panel
  shows the same "open official briefing" fallback as static mode.

  **Before relying on this**, read the "Nutzungsbedingungen" (terms of use)
  you accept when logging in at ais.dfs.de — they weren't reviewed as part of
  building this, and it's worth confirming scripted/on-demand queries are
  fine under your account.

Every panel shows a "fetched at" timestamp either way — **this is a prep
aid, not an official briefing.**

## Local development

```bash
npm install
npm run dev          # http://localhost:3000 — hosted mode, /api/notams works
npm run fetch-data    # regenerate public/data/**/weather.json locally
npm run build         # normal (hosted) build
npm run build:pages   # static export to ./out, as deployed to GitHub Pages
npm run lint
```

> `build:pages` temporarily moves `src/app/api` out of the way (see
> [Modes & live data](#modes--live-data)). On Windows, a concurrently
> running `next dev` can hold a file-watcher lock on that folder that makes
> the move fail — stop any running dev server first if you hit an `EPERM`
> error from this script.

## Architecture

```
src/data/airports/        Airport reference data (registry in index.ts)
src/data/aircraft/        Aircraft specs (registry in index.ts) — performanceModel picks the chart UI
src/lib/aircraft-performance/  Per-aircraft takeoff/landing distance models (pa28-161-cadet.ts)
src/components/charts/   TakeoffNomogram.tsx / LandingNomogram.tsx — one pair per aircraft model
src/lib/                  atmosphere, wind-component, METAR types
src/lib/sources/          Live weather fetchers (aviationweather.ts, wetter-edka.ts) — server-only
src/lib/weather-fetch.ts  Orchestrates src/lib/sources/* per airport — used by /api/weather
src/lib/dfs-notams.ts     DFS NOTAM login + fetch + HTML parser — server-only
src/components/           UI (Dashboard, WeatherPanel, NotamPanel, AirportInfoPanel, PerformanceCalculator, charts/)
src/app/api/weather/      Hosted-mode-only Route Handler — live weather, same sources as the Action
src/app/api/notams/       Hosted-mode-only Route Handler — logs into DFS and fetches live
scripts/fetch-data.mjs    Entry point for the scheduled weather refresh
scripts/fetchers/         weather.mjs + wetter-edka.mjs — plain-JS twins of src/lib/sources/*
scripts/build-static.mjs  Builds the GitHub Pages export (hides src/app/api first)
public/data/<ICAO>/       Committed weather.json snapshots
.github/workflows/        deploy.yml (build + GitHub Pages), refresh-data.yml (cron weather refresh)
```

### Adding an airport or aircraft

**Airport:**
1. Create `src/data/airports/<ICAO>.ts` exporting an `Airport` (see `EDKA.ts`).
   Set `localMetarSource: "wetter-edka"` only if that specific site has a page
   for the new airport too — otherwise leave it unset and METAR/TAF both come
   from `weatherStationIcao` via aviationweather.gov.
2. Add it to the `AIRPORTS` map in `src/data/airports/index.ts`.
3. Add a matching entry to the `AIRPORTS` list in `scripts/fetch-data.mjs`
   (same `weatherStationIcao`/`localMetarSource`) so the scheduled refresh
   picks it up — this list is separate from the one in step 2 because that
   script runs in plain Node, not through Next's TS/bundler pipeline.

**Aircraft:**
1. Create `src/lib/aircraft-performance/<id>.ts` with the takeoff/landing
   distance formulas, calibrated to that aircraft's own POH chart(s) —
   there's no generic grid here, since each scanned nomogram has its own
   geometry and correction curves (see `pa28-161-cadet.ts`'s file comment
   for how that one was derived).
2. Create matching `src/components/charts/<X>Nomogram.tsx` component(s)
   reproducing that chart's layout, gridlines, and trace path (see
   `TakeoffNomogram.tsx`/`LandingNomogram.tsx`).
3. Create `src/data/aircraft/<id>.ts` with specs/V-speeds and a new
   `performanceModel` id; add the dispatch in `PerformanceCalculator.tsx`
   (currently a single `if (aircraft.performanceModel !== "pa28-161-cadet")`
   guard) and the `id` to the `AIRCRAFT` map in `src/data/aircraft/index.ts`.

### Calibrating a chart

Rather than hand-editing curve constants from chat-reported numbers, the
takeoff chart's pressure-altitude lines can be calibrated visually:

1. Put the scanned chart page at `reference-charts/<id>-takeoff.png` (this
   directory is gitignored and local-only — see `src/app/api/reference-chart`)
   and run the app in hosted mode (`npm run dev`).
2. Open `http://localhost:3000/?edit=true`. The scan is shown underneath the
   vector drawing; pick a line (e.g. "3000 ft") from the row of buttons under
   the chart.
3. Drag the blue square handles at the ends of each axis until the vector
   gridlines line up with the scan's own printed gridlines. Click anywhere
   in the altitude/temperature panel to add a point to the selected line;
   drag existing (red) points so the curve traces the scan's actual line;
   double-click a point to remove it.
4. Copy the JSON panel's contents into chat, or click "Save to file" to
   write it straight to `src/data/aircraft-performance/pa28-161-cadet.calibration.json`.

This only covers the takeoff chart's pressure-altitude lines today — the
landing chart and the takeoff mass/wind correction fan-lines still use the
hardcoded formulas in `pa28-161-cadet.ts`. The data model
(`src/lib/aircraft-performance/calibration.ts`: axis anchors + per-line
points) and the `/api/chart-calibration` save route are both generic enough
to extend to those, and to future aircraft, without redesigning anything.

## Open items

- **PA-28-161 Cadet performance model is a calibrated reconstruction, not a
  verified digitization.** `src/lib/aircraft-performance/pa28-161-cadet.ts`
  reproduces exactly one worked example per chart (so it's exact at those
  two points); the curve shape elsewhere comes from a reconstruction the
  aircraft owner supplied, built the same way — matched to the printed
  example, not independently verified against the full original curves.
  The "original scan instead of vectors" toggle on each chart exists
  precisely so you can check that yourself.
- **The DFS NOTAM login hasn't been confirmed end-to-end by me** — the HTML
  parser (`parseNotamTables` in `src/lib/dfs-notams.ts`) was validated
  against a real captured briefing page, but I haven't personally run the
  login step against a live account. If DFS changes their HTML, that same
  function is the only place that needs updating.
- **EDKA reference data** (runway, elevation, frequencies, notes) was cross-
  checked against the airfield operator's own site, OpenAIP, and a
  Jeppesen/Navigraph chart — that last source is explicitly licensed "for
  flight simulation only, not for navigational use," so only its plain
  factual numbers were used (independently matching the other two sources),
  never its procedural text verbatim. Cross-check against the current eAIP
  Germany before relying on any of this operationally.
- GitHub **disables scheduled workflows after 60 days of repository
  inactivity** — if weather data goes stale, re-trigger `refresh-data.yml`
  manually (or push any commit) to restart the schedule.
