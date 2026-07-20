"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Thin admin-specific wrapper around the shared Button — used to duplicate
// Button's entire visual language independently (own shadow values, own
// scale/timing), which drifted out of sync with it over time. Composing
// Button directly means the two can never diverge again; only the variant
// names differ (admin's smaller day-to-day set vs. Button's full range).
interface AdminButtonProps extends Omit<ButtonProps, "variant" | "size"> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "default" | "sm" | "xs";
}

const variantMap: Record<NonNullable<AdminButtonProps["variant"]>, ButtonProps["variant"]> = {
  primary: "primary",
  outline: "outline",
  ghost: "ghost",
  danger: "destructive",
};

// AdminButton's "xs" has no Button equivalent — sized down via className
// rather than adding a one-off size variant to the shared component.
const sizeMap: Record<NonNullable<AdminButtonProps["size"]>, { size: ButtonProps["size"]; className?: string }> = {
  default: { size: "default" },
  sm: { size: "sm" },
  xs: { size: "sm", className: "h-7 px-3 text-[11px]" },
};

const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    const { size: mappedSize, className: sizeClassName } = sizeMap[size];
    return (
      <Button
        ref={ref}
        variant={variantMap[variant]}
        size={mappedSize}
        className={cn(sizeClassName, className)}
        {...props}
      />
    );
  }
);
AdminButton.displayName = "AdminButton";

export { AdminButton };
