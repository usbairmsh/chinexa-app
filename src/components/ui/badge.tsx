import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-charcoal",
        secondary: "bg-secondary !text-white",
        outline: "border border-border text-charcoal-light",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        destructive: "bg-destructive/10 text-destructive",
        gold: "bg-gold/10 text-gold",
        // Product badges: mapped onto the design tokens (with alpha tints) so
        // they adapt to the dark theme, instead of the raw emerald/red/amber/
        // violet/rose/blue palette which stayed light-on-light in dark mode.
        new: "bg-success/10 text-success border border-success/25",
        sale: "bg-destructive/10 text-destructive border border-destructive/25",
        bestseller: "bg-gold/10 text-gold border border-gold/30",
        preorder: "bg-secondary/10 text-secondary border border-secondary/25",
        limited: "bg-coral/10 text-coral border border-coral/25",
        trending: "bg-primary/15 text-primary-dark border border-primary/30",
        exclusive: "bg-gold/10 text-gold border border-gold/30",
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
