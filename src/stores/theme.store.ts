"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Duration must match the .theme-transition rule in globals.css.
const THEME_TRANSITION_MS = 400;
let transitionTimer: ReturnType<typeof setTimeout> | null = null;

// Applies (or removes) the `.dark` class on <html>, which flips every CSS
// color token defined in globals.css. Safe to call on the server (no-op).
// When `animate` is true, the .theme-transition class is added around the
// flip so colors cross-fade; it's removed once the transition finishes so it
// never affects normal hovers/interactions. Rehydration on page load passes
// animate=false for an instant, flash-free apply.
function applyTheme(theme: Theme, animate = false) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transition");
    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      root.classList.remove("theme-transition");
      transitionTimer = null;
    }, THEME_TRANSITION_MS + 50);
  }

  root.classList.toggle("dark", theme === "dark");
}

// Persisted with the same "chinexa-<domain>" localStorage convention as the
// auth store. First-time visitors default to light (opt-in dark) — the
// no-flash inline script in the root layout reads this same key before paint
// so there's no light→dark flash on reload.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      // User-initiated changes animate; rehydration (below) does not.
      setTheme: (theme) => { applyTheme(theme, true); set({ theme }); },
      toggleTheme: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark";
        applyTheme(next, true);
        set({ theme: next });
      },
    }),
    {
      name: "chinexa-theme",
      // On rehydration from localStorage, re-apply the class so the store and
      // the DOM (already set by the inline script) stay in agreement.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
