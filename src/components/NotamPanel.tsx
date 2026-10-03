"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { HOSTED_MODE, notamsApiUrl } from "@/lib/data-paths";
import { DFS_BRIEFING_URL } from "@/lib/dfs-notams-constants";
import type { NotamItem } from "@/lib/notams";
import type { Airport } from "@/data/airports/types";

interface NotamApiResult {
  icao: string;
  fetchedAt: string;
  source: string;
  briefingUrl: string;
  notams: NotamItem[];
  error: string | null;
}

type FetchState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: NotamApiResult };

export function NotamPanel({ airport }: { airport: Airport }) {
  const [state, setState] = useState<FetchState>({ status: "idle" });

  async function handleFetch() {
    setState({ status: "loading" });
    try {
      const res = await fetch(notamsApiUrl(airport.icao), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as NotamApiResult;
      setState({ status: "ready", data });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <Panel title="NOTAMs" subtitle={`for ${airport.icao}`} action={<AlertTriangle size={18} className="text-foreground-muted" />}>
      {!HOSTED_MODE ? (
        <div className="space-y-3">
          <p className="text-sm text-warn">
            Only available in hosted mode. This static build (GitHub Pages) has no server to run the DFS NOTAM login
            on — run your own instance (<code className="tabular">npm run dev</code>, or build &amp; host it yourself) to fetch
            NOTAMs live.
          </p>
          <BriefingLink url={DFS_BRIEFING_URL} />
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleFetch}
            disabled={state.status === "loading"}
            className="instrument-frame inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted transition hover:text-accent disabled:opacity-60"
          >
            {state.status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Fetch NOTAMs
          </button>

          {state.status === "error" && <p className="text-sm text-danger">Couldn&apos;t fetch NOTAMs ({state.message}).</p>}
          {state.status === "ready" && <NotamResult data={state.data} />}
        </div>
      )}
    </Panel>
  );
}

function NotamResult({ data }: { data: NotamApiResult }) {
  if (data.error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-warn">{data.error}</p>
        <BriefingLink url={data.briefingUrl} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.notams.length === 0 ? (
        <p className="text-sm text-vfr">No active NOTAMs reported for {data.icao}.</p>
      ) : (
        <ul className="space-y-2">
          {data.notams.map((n) => (
            <li key={n.id} className="instrument-frame rounded-sm p-3">
              <p className="tabular text-xs font-semibold text-accent">{n.id}</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-foreground-muted">
        Fetched {new Date(data.fetchedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })} from {data.source}.
        Always get an official briefing before flight.
      </p>
    </div>
  );
}

function BriefingLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
      Open the official briefing source <ExternalLink size={14} />
    </a>
  );
}
