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
        new: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        sale: "bg-red-50 text-red-700 border border-red-200",
        bestseller: "bg-amber-50 text-amber-700 border border-amber-200",
        preorder: "bg-violet-50 text-violet-700 border border-violet-200",
        limited: "bg-rose-50 text-rose-700 border border-rose-200",
        trending: "bg-blue-50 text-blue-700 border border-blue-200",
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
