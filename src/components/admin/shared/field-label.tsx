"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

/**
 * Field label text plus a "?" icon whose tooltip carries the field's
 * meaning — used instead of a description line under the field, or an
 * explanation crammed into the visible label itself. Carries its own
 * TooltipProvider so it works when dropped into any admin page without
 * that page needing to set one up.
 */
export function FieldLabel({ label, hint }: { label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      {hint && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" tabIndex={-1} className="text-charcoal-lighter/60 hover:text-secondary transition-colors">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">{hint}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
}
