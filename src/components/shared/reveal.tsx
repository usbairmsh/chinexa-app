"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight scroll-reveal — a CSS-only replacement for the trivial
 * `motion.div initial={{opacity:0}} whileInView={{opacity:1}}` fade wrappers
 * that were pulling framer-motion into the homepage's critical path.
 *
 * Uses a single shared IntersectionObserver-per-element (no library, ~0 main
 * thread cost) to add an `is-visible` class once the element scrolls in, then
 * disconnects. Honors prefers-reduced-motion (renders visible immediately).
 *
 * Keep framer-motion only where it does real work — carousels, hover overlays,
 * enter/exit state machines. For "just fade it in on view", use this.
 */

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** ms delay before the fade starts once in view. */
  delay?: number;
  /** Render as visible on mount without waiting for scroll (above-the-fold). */
  immediate?: boolean;
  as?: "div" | "section" | "li" | "span";
}

export function Reveal({
  children,
  className,
  delay = 0,
  immediate = false,
  as = "div",
  style,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(immediate);

  useEffect(() => {
    if (immediate) return;
    const el = ref.current;
    if (!el) return;
    // Respect reduced motion — show immediately, skip the observer.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [immediate]);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={cn("chx-reveal", visible && "is-visible", className)}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
