"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// Smooth scroll for the STOREFRONT only. The admin panel scrolls an inner
// <main> overflow container (not the window), so Lenis — which hijacks window
// scroll — must never run there or it would break admin scrolling. We also
// skip it entirely when the user prefers reduced motion.
//
// Lenis dispatches native scroll events and keeps window.scrollY in sync, so
// existing scroll listeners (header shrink, ScrollToTop button) and
// window.scrollTo(...) calls keep working unchanged.
export function LenisProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      // Gentle ease-out; feels premium without lag on cheap devices.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch is left native — momentum scrolling on phones already feels right
      // and hijacking it hurts more than it helps on low-end Android.
      syncTouch: false,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [isAdmin]);

  return <>{children}</>;
}
