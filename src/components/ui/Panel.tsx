import type { ReactNode } from "react";
import clsx from "clsx";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("instrument-frame rounded-sm p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">{title}</h2>
          {subtitle ? <div className="mt-1 text-xs text-foreground-muted">{subtitle}</div> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
