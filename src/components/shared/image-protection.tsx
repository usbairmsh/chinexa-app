"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Blocks the casual image-saving paths on customer-facing pages: right-click
 * → "Save image as", Android long-press (both fire `contextmenu`), and
 * drag-the-image-to-desktop. Paired with the img CSS in globals.css that
 * kills the iOS long-press callout, drag ghost and select-highlight.
 *
 * Deliberately NOT active on /admin — admins manage these images and need
 * normal browser behavior for their own uploads.
 *
 * Honest scope: this deters saving, it cannot prevent it. The browser has
 * necessarily downloaded every image it displays, and screenshots or the
 * DevTools network tab are always available to a determined visitor.
 */
export function ImageProtection() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) return;
    const onContextMenu = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("img, picture")) e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("img, picture")) e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, [isAdmin]);

  return null;
}
