"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/stores/theme.store";
import { cn } from "@/lib/utils";

// A sun/moon that rotates + scales as it swaps, so the toggle itself animates
// alongside the page's color cross-fade. Shared by both variants.
function AnimatedThemeIcon({ isDark, className }: { isDark: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "sun" : "moon"}
          initial={{ rotate: -90, scale: 0, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="flex"
        >
          {isDark
            ? <Sun className="h-full w-full text-gold" />
            : <Moon className="h-full w-full text-secondary" />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Light/dark toggle. Two presentations share one behaviour:
//   variant="icon" — a round icon button (header / admin topbar)
//   variant="row"  — a full-width labelled row (mobile drawers / sidebars)
// Until mounted we render a stable placeholder so server and client markup
// match (the actual theme was already applied pre-paint by the layout script).
export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "row";
  className?: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className={cn(
          "flex items-center gap-3 py-2.5 px-2 rounded-xl text-sm text-charcoal-light hover:bg-primary-light transition-colors w-full",
          className,
        )}
      >
        <AnimatedThemeIcon isDark={isDark} className="h-4 w-4" />
        <span>{isDark ? "Light mode" : "Dark mode"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex items-center justify-center h-9 w-9 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-primary-light transition-colors",
        className,
      )}
    >
      <AnimatedThemeIcon isDark={isDark} className="h-[18px] w-[18px]" />
    </button>
  );
}
