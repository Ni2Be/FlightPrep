"use client";

import { useEffect, useState } from "react";
import { CloudSun, Loader2, RefreshCcw } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { FlightCategoryBadge } from "@/components/ui/FlightCategoryBadge";
import { HOSTED_MODE, weatherApiUrl, weatherDataUrl } from "@/lib/data-paths";
import { ceilingFt, computeFlightCategory, type WeatherSnapshot } from "@/lib/metar";
import type { Airport } from "@/data/airports/types";

type FetchState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: WeatherSnapshot };

export function WeatherPanel({ airport }: { airport: Airport }) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [liveFetching, setLiveFetching] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(weatherDataUrl(airport.icao), { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<WeatherSnapshot>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [airport.icao]);

  async function handleFetchLive() {
    setLiveFetching(true);
    setLiveError(null);
    try {
      const res = await fetch(weatherApiUrl(airport.icao), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as WeatherSnapshot;
      setState({ status: "ready", data });
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : String(err));
    } finally {
      setLiveFetching(false);
    }
  }

  return (
    <Panel
      title="Weather"
      subtitle={
        airport.weatherStationNote ? <span>{airport.weatherStationNote}</span> : <span>Station: {airport.weatherStationIcao}</span>
      }
      action={
        HOSTED_MODE ? (
          <button
            type="button"
            onClick={handleFetchLive}
            disabled={liveFetching}
            className="instrument-frame inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted transition hover:text-accent disabled:opacity-60"
          >
            {liveFetching ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
            Fetch live
          </button>
        ) : (
          <CloudSun size={18} className="text-foreground-muted" />
        )
      }
    >
      {liveError && <p className="mb-3 text-sm text-danger">Live fetch failed ({liveError}).</p>}

      {state.status === "loading" && <p className="text-sm text-foreground-muted">Loading weather snapshot…</p>}

      {state.status === "error" && (
        <p className="text-sm text-danger">
          Couldn&apos;t load the weather snapshot ({state.message}). It&apos;s written by the scheduled data-refresh workflow —
          run <code className="tabular">npm run fetch-data</code> locally to generate it.
        </p>
      )}

      {state.status === "ready" && <WeatherContent data={state.data} />}
    </Panel>
  );
}

function WeatherContent({ data }: { data: WeatherSnapshot }) {
  if (!data.ok || !data.metar) {
    return <p className="text-sm text-warn">No current METAR available: {data.error ?? "unknown error"}</p>;
  }

  const { metar, taf } = data;
  const category = metar.flightCategory ?? computeFlightCategory(metar.visibilitySM, ceilingFt(metar.clouds));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FlightCategoryBadge category={category} />
        <span className="tabular text-xs text-foreground-muted">as of {formatTime(metar.obsTime)}</span>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Wind" value={formatWind(metar)} />
        <Field label="Visibility" value={metar.visibilitySM != null ? `${metar.visibilitySM} SM` : "—"} />
        <Field label="Temp / Dewpoint" value={`${fmtTemp(metar.tempC)} / ${fmtTemp(metar.dewpointC)}`} />
        <Field label="Altimeter" value={metar.altimeterHpa != null ? `${metar.altimeterHpa} hPa` : "—"} />
      </dl>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">METAR &middot; {metar.source}</p>
        <p className="tabular rounded-sm bg-background-elevated p-2 text-xs leading-relaxed text-foreground">{metar.raw}</p>
      </div>

      {taf && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">TAF &middot; {taf.source}</p>
          <p className="tabular rounded-sm bg-background-elevated p-2 text-xs leading-relaxed text-foreground">{taf.raw}</p>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
        <RefreshCcw size={12} />
        Fetched {formatTime(data.fetchedAt)}. Always get an official briefing before flight.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-foreground-muted">{label}</dt>
      <dd className="tabular text-sm text-foreground">{value}</dd>
    </div>
  );
}

function fmtTemp(c: number | null): string {
  return c == null ? "—" : `${c}°C`;
}

function formatWind(metar: WeatherSnapshot["metar"]): string {
  if (!metar || metar.windSpeedKt == null) return "—";
  const dir = metar.windDirDeg === "VRB" ? "VRB" : metar.windDirDeg != null ? `${String(metar.windDirDeg).padStart(3, "0")}°` : "—";
  const gust = metar.windGustKt ? ` G${metar.windGustKt}` : "";
  return `${dir} / ${metar.windSpeedKt}${gust} kt`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  } catch {
    return iso;
  }
}
