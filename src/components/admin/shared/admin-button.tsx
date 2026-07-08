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
          "inline-flex items-center justify-center gap-2 rounded-full font-body font-semibold tracking-wide transition-all duration-300 ease-out cursor-pointer active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
          // Variants
          variant === "primary" && "bg-secondary !text-white hover:bg-secondary-dark hover:!text-white hover:shadow-[0_6px_30px_rgba(122,79,160,0.4)] hover:-translate-y-[1px]",
          variant === "outline" && "border-2 border-secondary/30 bg-white !text-secondary hover:bg-secondary hover:!text-white hover:border-secondary hover:shadow-[0_6px_25px_rgba(122,79,160,0.25)] hover:-translate-y-[1px]",
          variant === "ghost" && "!text-charcoal-light hover:bg-pearl hover:!text-charcoal hover:shadow-sm",
          variant === "danger" && "bg-destructive !text-white hover:bg-destructive/90 hover:shadow-[0_6px_20px_rgba(239,68,68,0.3)] hover:-translate-y-[1px]",
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
