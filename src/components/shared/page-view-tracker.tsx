"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Fires a fire-and-forget page-view beacon on every storefront route change,
// feeding the admin dashboard's Traffic & Conversions chart from our own DB
// (no external analytics dependency). Renders nothing.
//
// Uses navigator.sendBeacon so the request survives the page unloading and
// never blocks navigation; falls back to a keepalive fetch where sendBeacon
// is unavailable. Admin/api paths are ignored here AND server-side.
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    const payload = JSON.stringify({ path: pathname });
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/track", blob);
      } else {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never let analytics break the page.
    }
  }, [pathname]);

  return null;
}
