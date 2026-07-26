"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Applies (or removes) the `.dark` class on <html>, which flips every CSS
// color token defined in globals.css. Safe to call on the server (no-op).
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Persisted with the same "chinexa-<domain>" localStorage convention as the
// auth store. First-time visitors default to light (opt-in dark) — the
// no-flash inline script in the root layout reads this same key before paint
// so there's no light→dark flash on reload.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => { applyTheme(theme); set({ theme }); },
      toggleTheme: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark";
        applyTheme(next);
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
