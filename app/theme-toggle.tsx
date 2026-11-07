"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const KEY = "theme";
const EVENT = "themechange";

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    // Private windows and blocked site data both throw rather than return
    // null, so the catch is load-bearing, not defensive padding.
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  // 'storage' fires in the *other* tabs, so a change here follows along there.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The theme lives in localStorage and on <html>, which makes it external state
 * rather than React state. useSyncExternalStore is the sanctioned way to read
 * that: it takes a separate server snapshot, so hydration starts from the same
 * "system" the server rendered and then settles, instead of either mismatching
 * or needing a setState inside an effect.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  const choose = useCallback((next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // The attribute below still applies for this page view.
    }
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "☀" },
    { value: "dark", label: "Dark", icon: "☾" },
    { value: "system", label: "System", icon: "◐" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="panel-sm pill flex items-center gap-0.5 bg-paper-raised p-0.5"
    >
      {options.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.value)}
            title={`${o.label} theme`}
            className={`pill px-2.5 py-1 text-xs font-bold transition ${
              active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-ink/10 hover:text-ink"
            }`}
          >
            <span aria-hidden="true">{o.icon}</span>
            <span className="ml-1 hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
