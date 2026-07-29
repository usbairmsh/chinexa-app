import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * ChineXa brand loader — the logo's own heart-leaf tree (cropped from the logo,
 * so it's pixel-identical) with a few blossom leaves gently detaching and
 * drifting down in the logo's crimson→pink palette. Pure <img> + CSS keyframes:
 * no framer-motion, so it stays lightweight and renders before the heavy client
 * bundle loads.
 */

interface BrandLoaderProps {
  /** Width of the tree mark in px. Falling leaves scale with it. */
  size?: number;
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

export function BrandLoader({ size = 132, label = "Loading" }: BrandLoaderProps) {
  // The cropped mark is 265×205 → keep that aspect ratio.
  const h = Math.round(size * (205 / 265));
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="relative" style={{ width: size, height: h }}>
        {/* The logo's actual tree — gently "breathes" so it feels alive. */}
        <Image
          src="/tree-mark.png"
          alt="ChineXa"
          width={265}
          height={205}
          priority
          className="chx-tree h-full w-full object-contain"
        />

        {/* Falling leaves — detach from the canopy and drift down past the trunk. */}
        {FALLING.map((f, i) => (
          <HeartLeaf
            key={i}
            fill={f.c}
            className="chx-leaf-fall absolute"
            style={{
              width: f.w,
              height: f.w,
              left: `${f.left}%`,
              top: `${f.top}%`,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.dur}s`,
              ["--drift" as string]: `${f.drift}px`,
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

// Falling petals: start points spread across the whole canopy (% of the mark
// box), varied size/timing so several leaves are always mid-air at once from
// random-looking positions. Colors sampled from the logo — deep crimson, mid
// red, bright pink, soft blossom. Short, staggered delays + a couple that drift
// a little sideways keep the fall looking natural rather than in lockstep.
const FALLING = [
  { left: 20, top: 34, w: 13, c: "#C0143C", delay: 0.0, dur: 2.7, drift: -14 },
  { left: 33, top: 22, w: 10, c: "#7E1533", delay: 0.5, dur: 3.2, drift: 6 },
  { left: 41, top: 40, w: 14, c: "#F3A9BE", delay: 1.1, dur: 2.9, drift: -8 },
  { left: 50, top: 18, w: 11, c: "#D93A5B", delay: 0.3, dur: 3.4, drift: 12 },
  { left: 58, top: 33, w: 12, c: "#C0143C", delay: 1.6, dur: 2.6, drift: -10 },
  { left: 66, top: 26, w: 9, c: "#7E1533", delay: 0.8, dur: 3.1, drift: 4 },
  { left: 74, top: 38, w: 14, c: "#F3A9BE", delay: 2.0, dur: 2.8, drift: -6 },
  { left: 82, top: 30, w: 11, c: "#D93A5B", delay: 1.3, dur: 3.5, drift: 10 },
  { left: 28, top: 44, w: 12, c: "#D93A5B", delay: 2.4, dur: 3.0, drift: -12 },
  { left: 90, top: 42, w: 10, c: "#C0143C", delay: 1.9, dur: 3.3, drift: 8 },
];
