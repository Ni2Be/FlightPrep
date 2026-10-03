"use client";

import { useState } from "react";
import { Check, Copy, Save } from "lucide-react";
import { HOSTED_MODE, dataUrl } from "@/lib/data-paths";
import type { TakeoffCalibration, LandingCalibration } from "@/lib/aircraft-performance/calibration";

export function CalibrationPanel({
  aircraft,
  chart,
  calibration,
}: {
  aircraft: string;
  chart: "takeoff" | "landing";
  calibration: TakeoffCalibration | LandingCalibration;
}) {
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const json = JSON.stringify(calibration, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can still select the text manually */
    }
  }

  async function save() {
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(dataUrl("/api/chart-calibration"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aircraft, chart, calibration }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="instrument-frame rounded-sm p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
          Calibration JSON — {aircraft} / {chart}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted hover:text-accent">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
          {HOSTED_MODE && (
            <button
              type="button"
              onClick={save}
              disabled={saveState === "saving"}
              className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted hover:text-accent disabled:opacity-60"
            >
              <Save size={13} />
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save to file"}
            </button>
          )}
        </div>
      </div>
      {saveState === "error" && <p className="mb-2 text-xs text-danger">Save failed: {saveError}</p>}
      <textarea
        readOnly
        value={json}
        rows={14}
        className="tabular w-full rounded-sm bg-background-elevated p-2 text-xs leading-relaxed text-foreground outline-none"
        onFocus={(e) => e.currentTarget.select()}
      />
      <p className="mt-2 text-[11px] text-foreground-muted">
        Paste this here in chat, or (hosted mode) click &quot;Save to file&quot; to overwrite
        <code className="tabular"> src/data/aircraft-performance/{aircraft}.calibration.json</code> directly.
      </p>
    </div>
  );
}
