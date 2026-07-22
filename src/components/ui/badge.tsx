import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-charcoal",
        secondary: "bg-secondary text-white",
        outline: "border border-border text-charcoal-light",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        destructive: "bg-destructive/10 text-destructive",
        gold: "bg-gold/10 text-gold",
        // Product badges — solid, saturated fills with white text and a soft
        // colored shadow so they pop off the product photo instead of reading
        // as faint pastel chips.
        new: "bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)]",
        sale: "bg-red-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.35)]",
        bestseller: "bg-amber-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.35)]",
        preorder: "bg-violet-500 text-white shadow-[0_2px_8px_rgba(139,92,246,0.35)]",
        limited: "bg-rose-500 text-white shadow-[0_2px_8px_rgba(244,63,94,0.35)]",
        trending: "bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)]",
        exclusive: "bg-gold text-white shadow-[0_2px_8px_rgba(197,160,89,0.4)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
