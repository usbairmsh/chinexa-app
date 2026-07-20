"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/**
 * Click-to-open "?" help beside a field label, carrying the field's meaning
 * plus its requirement/format guidance. Distinct from the hover-only
 * FieldLabel tooltip: a click popover works on touch devices and has room
 * for the multi-line "what it is / what to enter" explanations the SEO
 * screens need, rather than a one-liner.
 */
export function FieldHelp({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${title}?`}
          className="text-charcoal-lighter/60 hover:text-secondary transition-colors active:scale-[0.9] shrink-0"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80">
        <p className="text-sm font-semibold text-charcoal mb-1.5">{title}</p>
        <div className="text-xs text-charcoal-light leading-relaxed space-y-1.5">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

/** Label row + help icon + the field itself — the standard layout for a helped field. */
export function HelpedField({
  label,
  help,
  helpTitle,
  required,
  right,
  children,
}: {
  label: string;
  help: React.ReactNode;
  helpTitle?: string;
  required?: boolean;
  /** Optional right-aligned slot on the label row — e.g. a character counter. */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="block text-sm font-medium text-charcoal-light">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        <FieldHelp title={helpTitle || label}>{help}</FieldHelp>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  );
}
