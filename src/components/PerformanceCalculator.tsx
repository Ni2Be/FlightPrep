"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, Wand2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { TakeoffNomogram } from "@/components/charts/TakeoffNomogram";
import { LandingNomogram } from "@/components/charts/LandingNomogram";
import { CalibrationPanel } from "@/components/charts/CalibrationPanel";
import { pressureAltitudeFt } from "@/lib/atmosphere";
import { trueToMagnetic, windComponents } from "@/lib/wind-component";
import { runwayEnds } from "@/lib/runways";
import { weatherDataUrl, weatherApiUrl, HOSTED_MODE } from "@/lib/data-paths";
import {
  computeTakeoff,
  computeLanding,
  kgToLb,
  DEFAULT_TAKEOFF_CALIBRATION,
  DEFAULT_LANDING_CALIBRATION,
  LANDING,
  TAKEOFF,
  type WindDirection,
} from "@/lib/aircraft-performance/pa28-161-cadet";
import type { TakeoffCalibration, LandingCalibration } from "@/lib/aircraft-performance/calibration";
import type { WeatherSnapshot } from "@/lib/metar";
import type { Airport, RunwaySurface } from "@/data/airports/types";
import type { Aircraft } from "@/data/aircraft/types";

const SURFACES: RunwaySurface[] = ["asphalt", "concrete", "grass", "gravel"];
// Not part of the ported chart model — these are the only generic surfaces
// the chart's own "Zusätzliche Zuschläge..." note tells you to account for
// yourself; applied as a separate step after the chart's own number.
const SURFACE_SURCHARGE_PERCENT: Partial<Record<RunwaySurface, { takeoff: number; landing: number }>> = {
  grass: { takeoff: 15, landing: 10 },
};

type FieldSource = "untouched" | "auto" | "manual";
type WeatherField = "tempC" | "qnhHpa" | "windDirMagDeg" | "windSpeedKt";

export function PerformanceCalculator({ airport, aircraft }: { airport: Airport; aircraft: Aircraft }) {
  const ends = useMemo(() => runwayEnds(airport), [airport]);

  const [chartKind, setChartKind] = useState<"takeoff" | "landing">("takeoff");
  const [massKg, setMassKg] = useState<number>(TAKEOFF.refMassKg);
  const [tempC, setTempC] = useState(15);
  const [qnhHpa, setQnhHpa] = useState(1013);
  const [windDirMagDeg, setWindDirMagDeg] = useState(0);
  const [windSpeedKt, setWindSpeedKt] = useState(0);
  // The chart needs a runway-relative headwind/tailwind component, which
  // windComponents() derives from wind speed + direction + runway heading —
  // realistic, but easy to get wrong by hand (a direction a few degrees off
  // the runway's reciprocal silently shrinks the component via cosine,
  // which looks like "the chart isn't using my full wind speed"). This
  // lets you set that component directly instead, bypassing the heading
  // math entirely; it's cleared whenever you edit speed/direction instead,
  // so the two input modes don't fight each other. Positive = headwind,
  // negative = tailwind — same sign convention as windComponents().
  const [windOverrideKt, setWindOverrideKt] = useState<number | null>(null);
  const [runwayEndId, setRunwayEndId] = useState(ends[0]?.id ?? "");
  const [surface, setSurface] = useState<RunwaySurface>(ends[0]?.surface ?? "asphalt");
  const [sources, setSources] = useState<Record<WeatherField, FieldSource>>({
    tempC: "untouched",
    qnhHpa: "untouched",
    windDirMagDeg: "untouched",
    windSpeedKt: "untouched",
  });
  const [fillError, setFillError] = useState<string | null>(null);

  // Always starts false so the first client render matches the server
  // render exactly (no hydration mismatch) — the real value, if any, is
  // picked up right after mount. See ThemeToggle.tsx for the same pattern.
  const [editRequested, setEditRequested] = useState(false);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("edit") === "true";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditRequested(requested);
  }, []);
  const [calibration, setCalibration] = useState<TakeoffCalibration>(DEFAULT_TAKEOFF_CALIBRATION);
  const [landingCalibration, setLandingCalibration] = useState<LandingCalibration>(DEFAULT_LANDING_CALIBRATION);

  async function fillFromWeather() {
    setFillError(null);
    try {
      // Hosted mode: hit the live endpoint (same one the Weather panel's
      // "Fetch live" button uses) rather than the committed snapshot — that
      // snapshot only updates via the scheduled Action, so after fetching
      // live weather in the panel above, filling from the stale snapshot
      // here would look like nothing happened.
      const res = await fetch(HOSTED_MODE ? weatherApiUrl(airport.icao) : weatherDataUrl(airport.icao), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as WeatherSnapshot;
      if (!data.metar) throw new Error("No current weather available");

      const next: Partial<Record<WeatherField, FieldSource>> = {};
      if (data.metar.tempC != null) {
        setTempC(data.metar.tempC);
        next.tempC = "auto";
      }
      if (data.metar.altimeterHpa != null) {
        setQnhHpa(data.metar.altimeterHpa);
        next.qnhHpa = "auto";
      }
      if (typeof data.metar.windDirDeg === "number") {
        setWindDirMagDeg(Math.round(trueToMagnetic(data.metar.windDirDeg, airport.magneticVariationDeg)));
        next.windDirMagDeg = "auto";
      }
      if (data.metar.windSpeedKt != null) {
        setWindSpeedKt(data.metar.windSpeedKt);
        next.windSpeedKt = "auto";
      }
      setWindOverrideKt(null);
      setSources((s) => ({ ...s, ...next }));
    } catch (err) {
      setFillError(err instanceof Error ? err.message : String(err));
    }
  }

  function manualSetter<T>(field: WeatherField, setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setSources((s) => ({ ...s, [field]: "manual" }));
    };
  }

  const selectedEnd = ends.find((e) => e.id === runwayEndId) ?? ends[0];
  const pressureAltFt = pressureAltitudeFt(airport.elevationFt, qnhHpa);
  const wind = selectedEnd ? windComponents(windDirMagDeg, windSpeedKt, selectedEnd.headingMagDeg) : null;
  const effectiveHeadwindKt = windOverrideKt ?? wind?.headwindKt ?? 0;
  const direction: WindDirection = effectiveHeadwindKt < 0 ? "tail" : "head";
  const windMagnitudeKt = Math.abs(effectiveHeadwindKt);

  const maxWindForDirection = chartKind === "landing" && direction === "tail" ? LANDING.maxTailwindKt : chartKind === "landing" ? LANDING.maxHeadwindKt : TAKEOFF.maxWindKt;
  const windExceedsChart = windMagnitudeKt > maxWindForDirection;
  const clampedWindKt = Math.min(windMagnitudeKt, maxWindForDirection);

  // Below the chart's lowest printed line is an unremarkable, common case
  // (a near-sea-level airport on a low-QNH day) — just use that lowest
  // line rather than refusing to show a result. Above the top line is a
  // rarer, more questionable extrapolation, so that still blocks below.
  const minPressureFt = chartKind === "takeoff" ? TAKEOFF.minPressureFt : LANDING.minPressureFt;
  const maxPressureFt = chartKind === "takeoff" ? TAKEOFF.maxPressureFt : LANDING.maxPressureFt;
  const pressureBelowChart = pressureAltFt < minPressureFt;
  const effectivePressureAltFt = Math.max(pressureAltFt, minPressureFt);
  const pressureInRange = effectivePressureAltFt <= maxPressureFt;
  const tempInRange = tempC >= TAKEOFF.minTempC && tempC <= TAKEOFF.maxTempC;

  const editMode = HOSTED_MODE && editRequested;
  const takeoff = computeTakeoff(effectivePressureAltFt, tempC, massKg, clampedWindKt, direction, calibration);
  const landing = computeLanding(effectivePressureAltFt, tempC, clampedWindKt, direction, landingCalibration);

  const surchargePercent = SURFACE_SURCHARGE_PERCENT[surface]?.[chartKind] ?? 0;
  const chartDistanceM = chartKind === "takeoff" ? takeoff.windAdjustedDistanceM : landing.obstacleM;
  const finalDistanceM = chartDistanceM * (1 + surchargePercent / 100);
  const marginM = selectedEnd ? selectedEnd.distanceAvailableM - finalDistanceM : null;

  if (aircraft.performanceModel !== "pa28-161-cadet") {
    return (
      <Panel title="Performance" action={<Gauge size={18} className="text-foreground-muted" />}>
        <p className="text-sm text-warn">No digitized performance charts for {aircraft.model} yet.</p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Performance"
      subtitle={
        <span className="text-warn">
          Approximation reconstructed from the POH nomogram scans, matched only at the printed worked example per chart. Not
          certified performance data — not for real flight planning.
        </span>
      }
      action={<Gauge size={18} className="text-foreground-muted" />}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["takeoff", "landing"] as const).map((kind) => (
            <button
              key={kind}
              onClick={() => setChartKind(kind)}
              className={
                "rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition " +
                (chartKind === kind ? "bg-accent text-background" : "instrument-frame text-foreground-muted hover:text-foreground")
              }
            >
              {kind}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={fillFromWeather}
          className="instrument-frame inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted transition hover:text-accent"
        >
          <Wand2 size={13} />
          Fill from weather
        </button>
      </div>

      {fillError && <p className="mb-3 text-xs text-danger">Couldn&apos;t fill from weather ({fillError}).</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {chartKind === "takeoff" && (
          <NumberField label="Mass (kg)" value={massKg} onChange={setMassKg} min={TAKEOFF.minMassKg} max={TAKEOFF.maxMassKg} />
        )}
        <NumberField label="OAT (°C)" value={tempC} onChange={manualSetter("tempC", setTempC)} source={sources.tempC} />
        <NumberField label="QNH (hPa)" value={qnhHpa} onChange={manualSetter("qnhHpa", setQnhHpa)} source={sources.qnhHpa} />
        <NumberField
          label="Wind speed (kt)"
          value={windSpeedKt}
          onChange={(v) => {
            manualSetter("windSpeedKt", setWindSpeedKt)(v);
            setWindOverrideKt(null);
          }}
          min={0}
          source={sources.windSpeedKt}
        />
        <NumberField
          label="Wind from (° mag)"
          value={windDirMagDeg}
          onChange={(v) => {
            manualSetter("windDirMagDeg", setWindDirMagDeg)(v);
            setWindOverrideKt(null);
          }}
          min={0}
          max={360}
          source={sources.windDirMagDeg}
        />
        <Select label="Runway" value={runwayEndId} onChange={setRunwayEndId}>
          {ends.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id} ({e.headingMagDeg}°)
            </option>
          ))}
        </Select>
        <Select label="Surface" value={surface} onChange={(v) => setSurface(v as RunwaySurface)}>
          {SURFACES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
        <LegendSwatch color="var(--accent)" label="auto-filled from weather" />
        <LegendSwatch color="var(--vfr)" label="hand-entered" />
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Pressure altitude" value={`${Math.round(pressureAltFt)} ft${pressureBelowChart ? ` (using ${minPressureFt} ft)` : ""}`} />
        <NumberField
          label="Headwind(+)/Tailwind(−) kt"
          value={Math.round(effectiveHeadwindKt)}
          onChange={setWindOverrideKt}
          source={windOverrideKt != null ? "manual" : "untouched"}
        />
        <Field label="Crosswind component" value={wind ? `${Math.abs(Math.round(wind.crosswindKt))} kt` : "—"} />
        <Field
          label={chartKind === "takeoff" ? "Liftoff speed" : "Approach speed"}
          value={chartKind === "takeoff" ? `${takeoff.speedKias.toFixed(1)} KIAS` : `${LANDING.approachSpeedKias} KIAS`}
        />
      </div>
      {windOverrideKt != null && (
        <p className="mt-1 text-[11px] text-foreground-muted">
          Overriding the computed wind component directly — edit &quot;Wind speed&quot; or &quot;Wind from&quot; above to go back to computing it
          from heading.
        </p>
      )}

      {!pressureInRange || !tempInRange ? (
        <p className="mt-4 text-sm text-warn">
          Inputs are outside the chart&apos;s visible field ({chartKind === "takeoff" ? `${TAKEOFF.minPressureFt}–${TAKEOFF.maxPressureFt} ft` : `${LANDING.minPressureFt}–${LANDING.maxPressureFt} ft`},{" "}
          {TAKEOFF.minTempC}–{TAKEOFF.maxTempC}°C) — not extrapolated.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {chartKind === "takeoff" ? (
              <Field label="Mass" value={`${Math.round(massKg)} kg (${Math.round(kgToLb(massKg))} lb)`} />
            ) : (
              <Field label="Ground roll" value={`${Math.round(landing.groundM)} m`} />
            )}
            <Field
              label={chartKind === "takeoff" ? "Ground roll" : "Over 15m obstacle"}
              value={`${Math.round(chartDistanceM)} m`}
              emphasis={chartKind === "landing"}
            />
            {surchargePercent > 0 && <Field label={`+${surface} surcharge`} value={`${Math.round(finalDistanceM)} m`} emphasis warn={marginM != null && marginM < 0} />}
          </div>

          {selectedEnd && marginM != null && (
            <div
              className={
                "rounded-sm border px-3 py-2 text-sm " +
                (marginM < 0 ? "border-danger text-danger" : marginM < 150 ? "border-warn text-warn" : "border-vfr text-vfr")
              }
            >
              {marginM < 0
                ? `Exceeds runway ${selectedEnd.id} by ${Math.abs(Math.round(marginM))} m — does not fit.`
                : `${Math.round(marginM)} m margin on runway ${selectedEnd.id} (${selectedEnd.distanceAvailableM} m available), ${surface} surface.`}
            </div>
          )}

          {windExceedsChart && (
            <p className="text-xs text-warn">
              Wind component ({Math.round(windMagnitudeKt)} kt {direction}) exceeds this chart&apos;s {maxWindForDirection} kt range — clamped for
              the calculation above.
            </p>
          )}

          {chartKind === "takeoff" ? (
            <TakeoffNomogram
              pressureFt={effectivePressureAltFt}
              tempC={tempC}
              massKg={massKg}
              windKt={clampedWindKt}
              direction={direction}
              speedKias={takeoff.speedKias}
              calibration={calibration}
              editable={editMode}
              onCalibrationChange={editMode ? setCalibration : undefined}
            />
          ) : (
            <LandingNomogram
              pressureFt={effectivePressureAltFt}
              tempC={tempC}
              windKt={clampedWindKt}
              direction={direction}
              calibration={landingCalibration}
              editable={editMode}
              onCalibrationChange={editMode ? setLandingCalibration : undefined}
            />
          )}

          {editMode && chartKind === "takeoff" && <CalibrationPanel aircraft="pa28-161-cadet" chart="takeoff" calibration={calibration} />}
          {editMode && chartKind === "landing" && <CalibrationPanel aircraft="pa28-161-cadet" chart="landing" calibration={landingCalibration} />}
        </div>
      )}
    </Panel>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full border" style={{ borderColor: color }} />
      {label}
    </span>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  source,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  source?: FieldSource;
}) {
  const borderColor = source === "auto" ? "var(--accent)" : source === "manual" ? "var(--vfr)" : undefined;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        style={borderColor ? { borderColor } : undefined}
        className="tabular instrument-frame rounded-sm px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      />
    </label>
  );
}

function Field({ label, value, emphasis, warn }: { label: string; value: string; emphasis?: boolean; warn?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-foreground-muted">{label}</dt>
      <dd className={"tabular " + (emphasis ? "text-base font-semibold" : "text-sm") + " " + (warn ? "text-danger" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}
