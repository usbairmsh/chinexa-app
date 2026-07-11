"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, icon, id, ...props }, ref) => {
    const inputId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-charcoal-light"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-lighter">
              {icon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            className={cn(
              "flex h-11 w-full rounded-luxury bg-beige-dark/70 px-4 py-2.5 text-sm text-charcoal transition-colors duration-200 ease-out caret-secondary shadow-[inset_0_0_0_1px_rgba(58,36,56,0.06)]",
              "placeholder:text-charcoal-lighter/70",
              "hover:bg-beige-dark",
              "focus:bg-white focus:outline-none focus:ring-0 focus:shadow-[inset_0_0_0_1.5px_var(--color-secondary)]",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
              icon && "pl-10",
              error && "text-destructive",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
