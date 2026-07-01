"use client";

import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  color?: string;
  opacity?: number;
  size?: number;
  className?: string;
  tooltip?: string;
}

export function VerifiedBadge({ color = "#3B82F6", opacity = 1, size = 19, className, tooltip }: VerifiedBadgeProps) {
  return (
    <span className={cn("inline-flex shrink-0", className)} title={tooltip}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Starburst seal shape with rounded peaks */}
        <path
          d="M12 1.5
             Q13.2 3.8 14.8 5.2
             Q16.8 3.6 19 3.8
             Q18.8 6.2 19.8 8
             Q22 8.8 23 10.5
             Q21.5 12.5 21.8 14.2
             Q23 16 22.2 18
             Q20 18.2 18.8 19.8
             Q19 21.8 17.2 22.5
             Q15.5 21 14 21.2
             Q12.8 23 11.2 23
             Q10 21.5 8.2 21.8
             Q6.8 23 5.2 22
             Q5.5 20 4 19
             Q2 18.5 1.8 16.5
             Q3.2 15 2.8 13.2
             Q1 12 1.5 10.2
             Q3 9.2 3.5 7.5
             Q2.5 5.5 4 4.2
             Q5.8 4.8 7.5 3.8
             Q8.5 1.8 10.5 1.5
             Q11 3 12 1.5Z"
          fill={color}
          opacity={opacity}
          strokeLinejoin="round"
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
  badgeSize = 19,
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
