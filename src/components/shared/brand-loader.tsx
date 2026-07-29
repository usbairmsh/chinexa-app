import { cn } from "@/lib/utils";

/**
 * ChineXa brand loader — a small heart-leaf tree (echoing the logo) whose
 * blossom-leaves gently detach and drift down, in the logo's crimson→pink
 * palette. Pure SVG + CSS keyframes: no framer-motion, so it stays lightweight
 * and can render before the heavy client bundle loads.
 *
 * Colors are taken straight from the brand tokens:
 *   trunk   #6E2A43   (--color-trunk)
 *   deep    #97395A   (--color-primary-700)  — inner canopy hearts
 *   mid     #BC4A72   (--color-primary-600)
 *   bright  #D9668F   (--color-primary-500)
 *   soft    #F2AFC9   (--color-primary-300)  — outer / falling petals
 */

interface BrandLoaderProps {
  /** Diameter of the tree mark in px. Falling leaves scale with it. */
  size?: number;
  className?: string;
  /** Optional caption under the mark. Pass "" to hide. */
  label?: string;
}

// A rounded heart leaf, same silhouette as the logo's canopy leaves.
function HeartLeaf({ fill, className, style }: { fill: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <path
        fill={fill}
        d="M12 21s-7.5-4.9-9.9-9.3C.7 8.9 2.2 5.5 5.4 5.1c1.9-.2 3.6.9 4.6 2.4l2 3 2-3c1-1.5 2.7-2.6 4.6-2.4 3.2.4 4.7 3.8 3.3 6.6C19.5 16.1 12 21 12 21z"
      />
    </svg>
  );
}

export function BrandLoader({ size = 84, label = "Loading" }: BrandLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="relative" style={{ width: size, height: size * 1.15 }}>
        {/* The tree mark */}
        <svg viewBox="0 0 120 140" className="h-full w-full" aria-hidden="true">
          {/* Trunk + branches */}
          <path
            d="M60 138 C58 120 58 108 59 96 M59 96 C50 88 44 80 40 70 M59 96 C70 86 76 78 82 66 M60 96 C60 84 61 74 62 62 M62 62 C56 56 50 52 46 46 M62 62 C70 56 76 50 80 44"
            fill="none"
            stroke="var(--color-trunk, #6E2A43)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Canopy of heart leaves — clustered, gradient from deep to soft */}
          {CANOPY.map((leaf, i) => (
            <g key={i} style={{ transformOrigin: `${leaf.x}px ${leaf.y}px` }} className="chx-leaf-breathe" data-d={i % 3}>
              <path
                transform={`translate(${leaf.x - 7} ${leaf.y - 7}) scale(${leaf.s})`}
                fill={leaf.c}
                d="M12 21s-7.5-4.9-9.9-9.3C.7 8.9 2.2 5.5 5.4 5.1c1.9-.2 3.6.9 4.6 2.4l2 3 2-3c1-1.5 2.7-2.6 4.6-2.4 3.2.4 4.7 3.8 3.3 6.6C19.5 16.1 12 21 12 21z"
              />
            </g>
          ))}
        </svg>

        {/* Falling leaves — absolutely positioned, drifting down past the trunk */}
        {FALLING.map((f, i) => (
          <HeartLeaf
            key={i}
            fill={f.c}
            className="chx-leaf-fall absolute"
            style={{
              width: f.w,
              height: f.w,
              left: `${f.left}%`,
              top: -4,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.dur}s`,
            }}
          />
        ))}
      </div>

      {label ? (
        <p className="text-sm font-medium tracking-wide text-charcoal-lighter">
          {label}
          <span className="chx-dots" aria-hidden="true" />
        </p>
      ) : null}
      <span className="sr-only">Loading, please wait</span>
    </div>
  );
}

/** Full-screen centered overlay variant (for route transitions / suspense). */
export function BrandLoaderScreen({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-sm",
        className
      )}
    >
      <BrandLoader label={label} />
    </div>
  );
}

// Canopy leaf positions (x,y in the 120×140 viewBox), scale, and color.
// Deep crimson at the core, softening to pink at the edges — mirrors the logo.
const CANOPY = [
  { x: 60, y: 40, s: 0.9, c: "#97395A" },
  { x: 46, y: 44, s: 0.8, c: "#BC4A72" },
  { x: 74, y: 44, s: 0.8, c: "#BC4A72" },
  { x: 40, y: 56, s: 0.75, c: "#D9668F" },
  { x: 80, y: 54, s: 0.8, c: "#BC4A72" },
  { x: 54, y: 30, s: 0.7, c: "#D9668F" },
  { x: 68, y: 30, s: 0.75, c: "#97395A" },
  { x: 34, y: 46, s: 0.65, c: "#F2AFC9" },
  { x: 86, y: 46, s: 0.7, c: "#F2AFC9" },
  { x: 50, y: 52, s: 0.85, c: "#97395A" },
  { x: 70, y: 52, s: 0.8, c: "#BC4A72" },
  { x: 60, y: 58, s: 0.7, c: "#D9668F" },
  { x: 44, y: 34, s: 0.6, c: "#F2AFC9" },
  { x: 78, y: 36, s: 0.65, c: "#D9668F" },
];

// Falling petals: horizontal position (%), size, timing.
const FALLING = [
  { left: 30, w: 12, c: "#D9668F", delay: 0, dur: 2.6 },
  { left: 52, w: 10, c: "#BC4A72", delay: 0.9, dur: 3.0 },
  { left: 66, w: 13, c: "#F2AFC9", delay: 1.6, dur: 2.8 },
  { left: 44, w: 9, c: "#97395A", delay: 2.2, dur: 3.2 },
];
