import { MapPin } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import type { Airport } from "@/data/airports/types";

export function AirportInfoPanel({ airport }: { airport: Airport }) {
  return (
    <Panel
      title="Airport"
      subtitle={`${airport.icao} — ${airport.name}, ${airport.country}`}
      action={<MapPin size={18} className="text-foreground-muted" />}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Elevation" value={`${airport.elevationFt} ft`} />
        <Field label="Pattern altitude" value={airport.patternAltitudeFt ? `${airport.patternAltitudeFt} ft` : "—"} />
        <Field label="Coordinates" value={`${airport.coordinates.lat.toFixed(4)}, ${airport.coordinates.lon.toFixed(4)}`} />
        <Field label="Magnetic variation" value={`${airport.magneticVariationDeg}° E`} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-foreground-muted">
              <th className="pb-1 pr-3 font-semibold">Runway</th>
              <th className="pb-1 pr-3 font-semibold">Dimensions</th>
              <th className="pb-1 pr-3 font-semibold">Surface</th>
              <th className="pb-1 font-semibold">TORA / LDA</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {airport.runways.map((rw) => (
              <tr key={rw.ident} className="border-t border-panel-border">
                <td className="py-1.5 pr-3">
                  {rw.ident} ({rw.headingsMagDeg[0]}°/{rw.headingsMagDeg[1]}°)
                </td>
                <td className="py-1.5 pr-3">
                  {rw.lengthM} × {rw.widthM} m
                </td>
                <td className="py-1.5 pr-3">{rw.surface}</td>
                <td className="py-1.5">{rw.toraLdaM ?? rw.lengthM} m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {airport.frequencies.map((f) => (
          <span key={f.label} className="tabular instrument-frame rounded-sm px-2 py-1 text-xs">
            {f.label}: {f.mhz.toFixed(3)}
          </span>
        ))}
      </div>

      {airport.notes && airport.notes.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-4 text-xs text-foreground-muted">
          {airport.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] text-foreground-muted">{airport.sourceNote}</p>
    </Panel>
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
