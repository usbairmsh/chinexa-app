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
        {/* Starburst seal shape */}
        <path
          d="M12 0l2.4 4.8 4.8-2.4-0.6 5.4 5.4 0.6-3.6 4.2 3.6 4.2-5.4 0.6 0.6 5.4-4.8-2.4L12 24l-2.4-4.8-4.8 2.4 0.6-5.4-5.4-0.6 3.6-4.2-3.6-4.2 5.4-0.6-0.6-5.4 4.8 2.4z"
          fill={color}
          opacity={opacity}
        />
        {/* Checkmark */}
        <path
          d="M8.5 12.5l2.5 2.5 4.5-5"
          stroke="white"
          strokeWidth="2.2"
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
