"use client";

import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  color?: string;
  opacity?: number;
  size?: number;
  className?: string;
  tooltip?: string;
}

export function VerifiedBadge({ color = "#3B82F6", opacity = 1, size = 16, className, tooltip }: VerifiedBadgeProps) {
  return (
    <span className={cn("inline-flex shrink-0", className)} title={tooltip}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Star/badge shape */}
        <path
          d="M12 1.5l2.39 3.19 3.96.58-2.59 3.22.34 4.01L12 10.95 7.9 12.5l.34-4.01L5.65 5.27l3.96-.58L12 1.5z"
          fill={color}
          opacity={opacity}
          transform="scale(1.15) translate(-1.5, -1)"
        />
        <path
          d="M12 2l2.09 2.79 3.46.5-2.27 2.82.3 3.51L12 9.87 8.42 11.62l.3-3.51L6.45 5.29l3.46-.5L12 2z"
          fill={color}
          opacity={opacity}
        />
        {/* Checkmark */}
        <path
          d="M9.5 11.5l2 2 3.5-4.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}

interface CustomerNameWithBadgeProps {
  name: string;
  badgeColor?: string;
  badgeOpacity?: number;
  badgeName?: string;
  badgeSize?: number;
  className?: string;
  nameClassName?: string;
}

export function CustomerNameWithBadge({
  name,
  badgeColor,
  badgeOpacity,
  badgeName,
  badgeSize = 16,
  className,
  nameClassName,
}: CustomerNameWithBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={nameClassName}>{name}</span>
      {badgeColor && (
        <VerifiedBadge
          color={badgeColor}
          opacity={badgeOpacity}
          size={badgeSize}
          tooltip={badgeName}
        />
      )}
    </span>
  );
}
