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
  const darkerColor = adjustBrightness(color, -20);

  return (
    <span className={cn("inline-flex shrink-0", className)} title={tooltip}>
      <svg
        width={size}
        height={size * (122.88 / 92.35)}
        viewBox="0 0 92.35 122.88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Badge top — user color */}
        <path
          fillRule="evenodd"
          fill={color}
          opacity={opacity}
          d="M46.18,0a9.26,9.26,0,0,1,5.61,1.76C54,3.16,56.45,5.91,59.5,7.65c4.28,2.45,12.22-.93,16.29,5.11,2.37,3.52,2.48,6.28,2.66,9a15.84,15.84,0,0,0,3.72,9.64c5,6.59,6,11,3.45,15.55-1.75,3.12-5.44,4.86-6.29,6.83-1.82,4.21.19,7.37-2.3,12.27a13.05,13.05,0,0,1-7.93,6.78c-3,1-6-.43-8.39.58C56.5,75.19,53.39,79.3,50,80.34a13,13,0,0,1-7.73,0c-3.35-1-6.46-5.15-10.66-6.92-2.4-1-5.4.39-8.39-.58a13,13,0,0,1-7.94-6.78C12.83,61.16,14.84,58,13,53.79c-.86-2-4.55-3.71-6.3-6.83-2.57-4.57-1.53-9,3.46-15.55a16,16,0,0,0,3.72-9.64c.17-2.73.28-5.49,2.66-9,4.06-6,12-2.66,16.29-5.11,3-1.74,5.51-4.49,7.7-5.88A9.29,9.29,0,0,1,46.18,0Z"
        />
        {/* Badge bottom — darker shade */}
        <path
          fillRule="evenodd"
          fill={darkerColor}
          opacity={opacity}
          d="M79.12,25.79a17.93,17.93,0,0,0,3,5.61c5,6.6,6,11,3.45,15.56-1.75,3.12-5.44,4.86-6.29,6.83-1.82,4.21.19,7.37-2.3,12.27a13.05,13.05,0,0,1-7.93,6.78c-3,1-6-.43-8.39.58C56.5,75.19,53.39,79.3,50,80.34a13,13,0,0,1-7.73,0c-3.35-1-6.46-5.15-10.66-6.92-2.4-1-5.4.39-8.39-.58a13,13,0,0,1-7.94-6.78A11.94,11.94,0,0,1,14,61.47L79.12,25.79Z"
        />
        {/* White circle */}
        <path fillRule="evenodd" fill="#fff" d="M46.06,16.94A24.15,24.15,0,1,1,21.91,41.09,24.15,24.15,0,0,1,46.06,16.94Z" />
        {/* Dark checkmark */}
        <path fillRule="evenodd" fill="#303030" d="M39.52,36.27l4.72,4.46,9.49-9.65c.93-.95,1.52-1.71,2.68-.52l3.76,3.84c1.23,1.22,1.17,1.94,0,3.08L46.38,51c-2.45,2.41-2,2.56-4.51.09l-8.68-8.63a1.1,1.1,0,0,1,.1-1.7l4.36-4.52c.66-.68,1.19-.64,1.87,0Z" />
        {/* Left ribbon */}
        <path fillRule="evenodd" fill="#303030" d="M3.39,113.07,15,111l5.73,10.25c4.15,5.15,6.79-3.31,8-6.26L39.78,94c-2.57-.89-5.66-3.47-8.85-6.35-6.35.13-12.27-1-16.62-6.51L1.5,105.85.38,108.23c-.87,3.08-.41,5.12,3,4.84Z" />
        {/* Right ribbon */}
        <path fillRule="evenodd" fill="#303030" d="M89,113.07,77.41,111l-5.74,10.25c-4.15,5.15-6.79-3.31-8-6.26L52.57,94c2.57-.89,5.67-3.47,8.85-6.35,6.35.13,12.27-1,16.62-6.51l12.82,24.75L92,108.23c.87,3.08.41,5.12-3,4.84Z" />
      </svg>
    </span>
  );
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(2.55 * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
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
