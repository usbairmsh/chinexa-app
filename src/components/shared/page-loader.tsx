"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandLoader } from "@/components/shared/brand-loader";

export function PageLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [prevPath, setPrevPath] = useState("");

  useEffect(() => {
    const currentPath = pathname + searchParams.toString();
    if (prevPath && prevPath !== currentPath) {
      // Path changed — loading is done
      setLoading(false);
    }
    setPrevPath(currentPath);
  }, [pathname, searchParams, prevPath]);

  // Intercept all link clicks to detect navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Buttons nested inside a <Link> (e.g. "Add to Bag"/wishlist controls on
      // a product card that's itself a link) call stopPropagation() in their
      // React onClick handler to prevent navigation — but that only stops
      // propagation within React's synthetic event tree. The native DOM click
      // still bubbles to this document-level listener regardless, since
      // native and synthetic event systems are separate. Bail out here so
      // clicking such a button doesn't show a full-page loading overlay for a
      // navigation that was never actually going to happen.
      if (target.closest("button")) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip external links, hash links, same page links
      if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      // Skip links that open in new tab
      if (anchor.target === "_blank") return;
      // Skip if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      const currentPath = pathname + searchParams.toString();
      if (href !== currentPath && href !== pathname) {
        setLoading(true);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname, searchParams]);

  // Safety timeout — if loading takes too long, hide it
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timeout);
  }, [loading]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center animate-fade-in">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm" />
      {/* ChineXa heart-leaf tree loader */}
      <div className="relative">
        <BrandLoader />
      </div>
    </div>
  );
}
