"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Next.js only auto-scrolls to top when the new page isn't already visible
 * in the viewport — if the previous page was scrolled down and the new page
 * is similarly tall, the scroll position carries over, landing the user
 * mid- or end-of-page instead of at the top. Force it on every route change.
 */
export function RouteScrollReset() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}
