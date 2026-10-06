"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const EVENT = "themechange";

// The theme lives on <html data-theme="...">. These three functions let
// React read it and hear about changes without copying it into state.
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const onServer = (): Theme => "light";

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme); // remembered on this device only
  } catch {
    // Private browsing can block storage; the theme still changes for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Switches between the light (cream) and dark themes. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, onServer);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-pressed={theme === "dark"}
      className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-border"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
      <span suppressHydrationWarning>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
