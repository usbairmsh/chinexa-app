"use client";

import { useRef } from "react";
import { useAnimate } from "framer-motion";

/**
 * Plays a one-shot keyframe animation on hover that always finishes and
 * returns to rest — including when the cursor leaves mid-sequence.
 * `whileHover` interrupts immediately on hover-end, which snaps multi-keyframe
 * motions (bell ring, bag swing, heartbeat) to a stuck mid-pose instead of
 * completing back to 0. Driving it imperatively via `animate()` decouples
 * playback from hover state, so re-triggers while already playing are ignored.
 */
export function useIconPlay<T extends Element = HTMLElement>() {
  const [scope, animate] = useAnimate<T>();
  const playing = useRef(false);

  const play = (keyframes: Record<string, (string | number)[]>, duration: number) => {
    if (playing.current) return;
    playing.current = true;
    animate(scope.current!, keyframes, { duration, ease: "easeInOut" }).then(() => {
      playing.current = false;
    });
  };

  return { scope, play };
}
