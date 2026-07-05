"use client";

import { useEffect } from "react";

/** Registers the installability service worker (public/sw.js) once, client-side. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability degrades gracefully — the site still works without it.
    });
  }, []);

  return null;
}
