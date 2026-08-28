"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Area } from "@/lib/crop-image";

// A resizable-box image cropper: the image is shown fit-to-frame with a crop
// rectangle drawn over it. Drag the box to move it, drag any of the 8 handles
// to resize. Optional aspect-ratio locking (via presets). onChange reports the
// crop rectangle in SOURCE-image pixel coordinates (an `Area`) for the canvas
// crop routine.

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move";

interface Rect { x: number; y: number; w: number; h: number } // in displayed-image px

export function ImageCropper({ src, aspect, full = false, onChange }: {
  src: string;
  /** width/height ratio to lock the box to; undefined = free-form. */
  aspect?: number;
  /**
   * "Full" mode: use the whole image, uncropped. The box covers the entire
   * frame and can't be moved or resized, so the output keeps the original
   * dimensions instead of the 80% default crop.
   */
  full?: boolean;
  onChange: (area: Area | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Displayed image geometry (the <img> is object-contain inside the frame).
  const [disp, setDisp] = useState<{ left: number; top: number; w: number; h: number; natW: number; natH: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: Rect } | null>(null);

  // Compute where the image actually renders inside the frame (object-contain
  // letterboxes it), so the crop box maps cleanly back to source pixels.
  const measure = useCallback(() => {
    const wrap = wrapRef.current, img = imgRef.current;
    if (!wrap || !img || !img.naturalWidth) return;
    const fw = wrap.clientWidth, fh = wrap.clientHeight;
    const natW = img.naturalWidth, natH = img.naturalHeight;
    const scale = Math.min(fw / natW, fh / natH);
    const w = natW * scale, h = natH * scale;
    const left = (fw - w) / 2, top = (fh - h) / 2;
    setDisp({ left, top, w, h, natW, natH });
    // Default crop: 80% centered (respecting aspect if given).
    setRect((prev) => prev ?? (full ? { x: 0, y: 0, w, h } : defaultRect(w, h, aspect)));
  }, [aspect, full]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth) measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure, src]);

  // Reset the box when the preset changes. In Full mode it snaps to the whole
  // image, which is what makes the output the original, uncropped picture.
  useEffect(() => {
    if (disp) setRect(full ? { x: 0, y: 0, w: disp.w, h: disp.h } : defaultRect(disp.w, disp.h, aspect));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, full]);

  // Report the source-pixel Area whenever the box or geometry changes.
  useEffect(() => {
    if (!disp || !rect) { onChange(null); return; }
    const scale = disp.natW / disp.w; // display px → source px
    onChange({
      x: Math.round(rect.x * scale),
      y: Math.round(rect.y * scale),
      width: Math.round(rect.w * scale),
      height: Math.round(rect.h * scale),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, disp]);

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    // Full mode covers the whole image by definition — moving or resizing the
    // box would contradict it, so dragging is inert.
    if (!rect || full) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...rect } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !disp) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    let { x, y, w, h } = d.start;
    const minS = 24;

    if (d.handle === "move") {
      x = clamp(d.start.x + dx, 0, disp.w - w);
      y = clamp(d.start.y + dy, 0, disp.h - h);
    } else {
      // Resize by the grabbed edges.
      if (d.handle.includes("e")) w = d.start.w + dx;
      if (d.handle.includes("s")) h = d.start.h + dy;
      if (d.handle.includes("w")) { w = d.start.w - dx; x = d.start.x + dx; }
      if (d.handle.includes("n")) { h = d.start.h - dy; y = d.start.y + dy; }

      if (aspect) {
        // Lock ratio: derive the dimension from whichever axis the handle drives.
        if (d.handle === "n" || d.handle === "s") w = h * aspect;
        else h = w / aspect;
      }

      // Enforce minimums and keep inside the image bounds.
      w = Math.max(minS, w); h = Math.max(minS, h);
      if (d.handle.includes("w")) x = d.start.x + d.start.w - w;
      if (d.handle.includes("n")) y = d.start.y + d.start.h - h;
      x = clamp(x, 0, disp.w - minS); y = clamp(y, 0, disp.h - minS);
      w = Math.min(w, disp.w - x); h = Math.min(h, disp.h - y);
      if (aspect) { // re-fit after clamping so the ratio holds
        if (w / h > aspect) w = h * aspect; else h = w / aspect;
      }
    }
    setRect({ x, y, w, h });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  const handleDot = "absolute h-3 w-3 rounded-full border-2 border-white bg-secondary shadow";
  const handles: { h: Handle; cls: string; cursor: string }[] = [
    { h: "nw", cls: "-left-1.5 -top-1.5", cursor: "nwse-resize" },
    { h: "n", cls: "left-1/2 -translate-x-1/2 -top-1.5", cursor: "ns-resize" },
    { h: "ne", cls: "-right-1.5 -top-1.5", cursor: "nesw-resize" },
    { h: "e", cls: "-right-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
    { h: "se", cls: "-right-1.5 -bottom-1.5", cursor: "nwse-resize" },
    { h: "s", cls: "left-1/2 -translate-x-1/2 -bottom-1.5", cursor: "ns-resize" },
    { h: "sw", cls: "-left-1.5 -bottom-1.5", cursor: "nesw-resize" },
    { h: "w", cls: "-left-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  ];

  return (
    <div
      ref={wrapRef}
      className="relative h-72 w-full select-none overflow-hidden rounded-xl bg-charcoal/90"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt="Crop source"
        onLoad={measure}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      {disp && rect && (
        <>
          {/* Dim outside the crop box */}
          <div className="pointer-events-none absolute inset-0 bg-black/50" style={{
            clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${px(disp.left + rect.x)} ${px(disp.top + rect.y)}, ${px(disp.left + rect.x)} ${px(disp.top + rect.y + rect.h)}, ${px(disp.left + rect.x + rect.w)} ${px(disp.top + rect.y + rect.h)}, ${px(disp.left + rect.x + rect.w)} ${px(disp.top + rect.y)}, ${px(disp.left + rect.x)} ${px(disp.top + rect.y)})`,
          }} />
          {/* Crop box */}
          <div
            className={cn(
              "absolute border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]",
              full ? "cursor-default" : "cursor-move"
            )}
            style={{ left: disp.left + rect.x, top: disp.top + rect.y, width: rect.w, height: rect.h }}
            onPointerDown={onPointerDown("move")}
          >
            {/* rule-of-thirds grid — a composition aid for cropping, so it is
                pointless when the whole image is being kept. */}
            {!full && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border border-white/30" />)}
              </div>
            )}
            {!full && handles.map((hd) => (
              <div key={hd.h} className={cn(handleDot, hd.cls)} style={{ cursor: hd.cursor }} onPointerDown={onPointerDown(hd.h)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function defaultRect(w: number, h: number, aspect?: number): Rect {
  let bw = w * 0.8, bh = h * 0.8;
  if (aspect) { if (bw / bh > aspect) bw = bh * aspect; else bh = bw / aspect; }
  return { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const px = (n: number) => `${n}px`;
