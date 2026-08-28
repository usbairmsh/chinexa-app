"use client";

import { useRef, useCallback } from "react";

// Horizontal swipe detection for touch devices (phones and tablets alike — this
// keys off touch events, not a breakpoint, so it works on any device that has a
// touchscreen and stays inert on a mouse-only desktop).

/** Minimum horizontal travel before a gesture counts as a swipe. */
const SWIPE_THRESHOLD_PX = 45;

/**
 * Past this much vertical movement the gesture is treated as a page scroll, not
 * a swipe. Without it, scrolling the page over a gallery would flick through
 * images — the single most annoying way to get this wrong.
 */
const MAX_VERTICAL_DRIFT_PX = 60;

/** Beyond this the gesture is a slow drag or a long-press, not a flick. */
const MAX_DURATION_MS = 800;

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Returns touch handlers plus `didSwipe()`, which reports whether the gesture
 * that just finished was a swipe.
 *
 * `didSwipe()` exists because a swipe and a tap arrive as the same click on a
 * touchscreen. A container that also has an onClick — opening a lightbox, say —
 * must consult it and bail, or every swipe would also fire the tap action.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enabled?: boolean;
}): SwipeHandlers & { didSwipe: () => boolean } {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const swiped = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    // Multi-touch is a pinch/zoom, never a swipe.
    if (e.touches.length !== 1) { start.current = null; return; }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    swiped.current = false;
  }, [enabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !start.current) return;
    // A second finger mid-gesture means a pinch — abandon it.
    if (e.touches.length !== 1) start.current = null;
  }, [enabled]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !start.current) return;
    const s = start.current;
    start.current = null;

    const t = e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;

    if (Date.now() - s.t > MAX_DURATION_MS) return;
    // Vertical intent wins: this is a scroll, leave it to the page.
    if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    // Mostly-diagonal drags are ambiguous; require a clearly horizontal one.
    if (Math.abs(dx) <= Math.abs(dy)) return;

    swiped.current = true;
    // Swiping LEFT (finger moves left, dx negative) advances to the next image,
    // matching how every native photo gallery behaves.
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  }, [enabled, onSwipeLeft, onSwipeRight]);

  // Reset on read: a swipe suppresses exactly one click, so a genuine tap right
  // afterwards still works.
  const didSwipe = useCallback(() => {
    const was = swiped.current;
    swiped.current = false;
    return was;
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, didSwipe };
}
