"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-body text-sm font-semibold tracking-wide transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-white hover:bg-secondary-dark hover:shadow-[0_8px_28px_rgba(122,79,160,0.35)] hover:-translate-y-px",
        primary:
          "bg-secondary text-white hover:bg-secondary-dark hover:shadow-[0_8px_28px_rgba(122,79,160,0.35)] hover:-translate-y-px",
        secondary:
          "bg-secondary text-white hover:bg-secondary-dark hover:shadow-[0_8px_28px_rgba(122,79,160,0.35)] hover:-translate-y-px",
        outline:
          "border border-secondary/25 bg-white text-secondary hover:bg-secondary hover:text-white hover:border-secondary hover:shadow-[0_8px_24px_rgba(122,79,160,0.22)] hover:-translate-y-px",
        ghost:
          "text-charcoal-light hover:bg-pearl hover:text-charcoal",
        link:
          "text-secondary underline-offset-4 hover:underline hover:text-secondary-dark",
        luxury:
          "bg-gradient-to-r from-secondary to-coral text-white hover:shadow-[0_8px_28px_rgba(122,79,160,0.35)] hover:brightness-[1.08] hover:-translate-y-px",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 hover:shadow-[0_8px_24px_rgba(239,68,68,0.28)] hover:-translate-y-px",
        gold:
          "bg-gold text-white hover:bg-gold-light hover:shadow-[0_8px_24px_rgba(224,185,108,0.35)] hover:-translate-y-px",
      },
      size: {
        default: "h-10 px-6 py-2.5 text-[13px]",
        sm: "h-8 px-4 text-[12px]",
        lg: "h-12 px-8 text-[14px]",
        xl: "h-14 px-10 text-[15px]",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
