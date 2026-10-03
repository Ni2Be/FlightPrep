"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";
const STORAGE_KEY = "flightprep-theme";

export function ThemeToggle() {
  // Always start at "dark" so the very first client render matches the
  // server-rendered HTML exactly (no hydration mismatch). The real stored
  // preference is picked up in the effect below, *after* hydration — by
  // then layout.tsx's inline script has already applied it to <html> for
  // the actual page colors, so this is purely about which icon to show.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme | undefined) ?? "dark";
    // Intentional: this is the standard SSR-hydration-safe pattern for
    // syncing from a browser-only external system (the DOM/localStorage)
    // after mount — not the cascading-render case this lint rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private browsing, etc.) — theme just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      className="instrument-frame flex h-9 w-9 items-center justify-center rounded-sm text-foreground-muted transition hover:text-accent"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
