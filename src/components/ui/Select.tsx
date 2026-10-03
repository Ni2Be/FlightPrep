"use client";

import type { ReactNode } from "react";

export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="instrument-frame rounded-sm px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      >
        {children}
      </select>
    </label>
  );
}
