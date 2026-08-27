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
        // Product badges sit ON TOP of product photography, so the background is
        // SOLID (bg-card), not an alpha tint — a /10 tint let the image show
        // through and washed the label out to near-illegible. The hue is carried
        // by the text and border, so the colour identity is unchanged; only the
        // transparency is gone.
        new: "bg-card text-success border border-success/40",
        sale: "bg-card text-destructive border border-destructive/40",
        bestseller: "bg-card text-gold border border-gold/45",
        preorder: "bg-card text-secondary border border-secondary/40",
        limited: "bg-card text-coral border border-coral/40",
        trending: "bg-card text-primary-dark border border-primary/45",
        exclusive: "bg-card text-gold border border-gold/45",
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
