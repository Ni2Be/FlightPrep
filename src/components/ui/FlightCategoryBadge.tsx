import clsx from "clsx";
import type { FlightCategory } from "@/lib/metar";

const LABEL: Record<FlightCategory, string> = {
  VFR: "VFR",
  MVFR: "MVFR",
  IFR: "IFR",
  LIFR: "LIFR",
};

const COLOR_VAR: Record<FlightCategory, string> = {
  VFR: "var(--vfr)",
  MVFR: "var(--mvfr)",
  IFR: "var(--ifr)",
  LIFR: "var(--lifr)",
};

export function FlightCategoryBadge({ category }: { category: FlightCategory }) {
  const color = COLOR_VAR[category];
  return (
    <span
      className={clsx("tabular inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-semibold")}
      style={{
        color,
        borderColor: color,
        backgroundColor: "color-mix(in srgb, " + color + " 14%, transparent)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {LABEL[category]}
    </span>
  );
}
