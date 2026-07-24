"use client";

import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Subtle per-row SEO-completeness indicator for admin lists. Renders nothing
// (or a tiny "SEO ✓" when showComplete) when the missing list is empty; renders
// an amber chip listing exactly what's missing (native title tooltip) otherwise.
// Advisory only — never blocks anything.

interface SeoStatusChipProps {
  missing: string[];
  /** Show a small green "SEO" tick when nothing is missing (default: render nothing). */
  showComplete?: boolean;
  className?: string;
}

export function SeoStatusChip({ missing, showComplete = false, className }: SeoStatusChipProps) {
  if (missing.length === 0) {
    if (!showComplete) return null;
    return (
      <span
        className={cn("inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success", className)}
        title="All key SEO fields are filled in"
      >
        <Check className="h-2.5 w-2.5" /> SEO
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 cursor-help", className)}
      title={`Improve SEO — missing:\n• ${missing.join("\n• ")}`}
    >
      <AlertTriangle className="h-2.5 w-2.5" /> SEO {missing.length}
    </span>
  );
}
