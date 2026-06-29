"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "default" | "sm" | "xs";
}

const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  ({ className, variant = "primary", size = "default", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-body font-semibold tracking-wide transition-all duration-200 cursor-pointer active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
          // Variants
          variant === "primary" && "bg-charcoal !text-white hover:bg-secondary hover:!text-white hover:shadow-[0_4px_20px_rgba(192,57,43,0.3)]",
          variant === "outline" && "border border-border bg-white !text-charcoal hover:bg-charcoal hover:!text-white hover:border-charcoal",
          variant === "ghost" && "!text-charcoal-light hover:bg-pearl hover:!text-charcoal",
          variant === "danger" && "bg-destructive !text-white hover:bg-destructive/90 hover:shadow-lg",
          // Sizes
          size === "default" && "h-10 px-6 text-[13px]",
          size === "sm" && "h-8 px-4 text-[12px]",
          size === "xs" && "h-7 px-3 text-[11px]",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
AdminButton.displayName = "AdminButton";

export { AdminButton };
