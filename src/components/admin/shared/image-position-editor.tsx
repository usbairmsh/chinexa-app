"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Move, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CropValue {
  x: number;
  y: number;
  zoom: number;
}

export function parseCropString(val?: string): CropValue {
  if (!val) return { x: 50, y: 50, zoom: 1 };
  try {
    const parsed = JSON.parse(val);
    return { x: parsed.x ?? 50, y: parsed.y ?? 50, zoom: parsed.zoom ?? 1 };
  } catch {
    const parts = (val || "").replace(/%/g, "").split(/\s+/).map(Number);
    return { x: parts[0] || 50, y: parts[1] || 50, zoom: 1 };
  }
}

export function cropToString(crop: CropValue): string {
  return JSON.stringify({ x: crop.x, y: crop.y, zoom: crop.zoom });
}

interface Props {
  imageUrl: string;
  value: string; // JSON string of CropValue
  onChange: (val: string) => void;
  aspectRatio?: "square" | "video" | "banner"; // preview shape
}

export function ImagePositionEditor({ imageUrl, value, onChange, aspectRatio = "square" }: Props) {
  const crop = parseCropString(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const update = useCallback((c: CropValue) => onChange(cropToString(c)), [onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !dragStart.current) return;
      const dx = ((e.clientX - dragStart.current.x) / rect.width) * 100;
      const dy = ((e.clientY - dragStart.current.y) / rect.height) * 100;
      const nx = Math.round(Math.max(0, Math.min(100, dragStart.current.cx - dx)));
      const ny = Math.round(Math.max(0, Math.min(100, dragStart.current.cy - dy)));
      update({ ...crop, x: nx, y: ny });
    };
    const onUp = () => { setDragging(false); dragStart.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, crop, update]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    update({ ...crop, zoom: Math.round(Math.max(1, Math.min(3, crop.zoom + delta)) * 100) / 100 });
  };

  const adjustZoom = (delta: number) => update({ ...crop, zoom: Math.round(Math.max(1, Math.min(3, crop.zoom + delta)) * 100) / 100 });
  const nudge = (dx: number, dy: number) => update({ ...crop, x: Math.max(0, Math.min(100, crop.x + dx)), y: Math.max(0, Math.min(100, crop.y + dy)) });
  const reset = () => update({ x: 50, y: 50, zoom: 1 });

  const aspectClass = aspectRatio === "banner" ? "aspect-[16/7]" : aspectRatio === "video" ? "aspect-video" : "aspect-square";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium text-charcoal-lighter flex items-center gap-1">
          <Move className="h-3 w-3 text-secondary" /> Position & Zoom
        </label>
        <button type="button" onClick={reset} className="flex items-center gap-1 text-[9px] text-charcoal-lighter hover:text-secondary transition-colors">
          <RotateCcw className="h-2.5 w-2.5" /> Reset
        </button>
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        className={cn(
          "relative rounded-lg overflow-hidden border-2 transition-colors select-none",
          aspectClass,
          dragging ? "border-secondary cursor-grabbing" : "border-border/30 hover:border-secondary/40 cursor-grab"
        )}
      >
        <Image
          src={imageUrl}
          alt="Position preview"
          fill
          className="object-cover pointer-events-none"
          style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }}
          sizes="400px"
          unoptimized
        />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/10" />
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white/10" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 bg-pearl/60 rounded-md p-0.5">
          <button type="button" onClick={() => adjustZoom(-0.1)} disabled={crop.zoom <= 1} className="flex h-6 w-6 items-center justify-center rounded hover:bg-white text-charcoal-lighter hover:text-charcoal disabled:opacity-30 transition-all">
            <ZoomOut className="h-3 w-3" />
          </button>
          <span className="text-[9px] font-mono text-charcoal-lighter w-8 text-center">{Math.round(crop.zoom * 100)}%</span>
          <button type="button" onClick={() => adjustZoom(0.1)} disabled={crop.zoom >= 3} className="flex h-6 w-6 items-center justify-center rounded hover:bg-white text-charcoal-lighter hover:text-charcoal disabled:opacity-30 transition-all">
            <ZoomIn className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 bg-pearl/60 rounded-md p-0.5">
          {[{ l: "←", dx: -5, dy: 0 }, { l: "↑", dx: 0, dy: -5 }, { l: "↓", dx: 0, dy: 5 }, { l: "→", dx: 5, dy: 0 }].map((n) => (
            <button key={n.l} type="button" onClick={() => nudge(n.dx, n.dy)} className="flex h-6 w-6 items-center justify-center rounded hover:bg-white text-charcoal-lighter hover:text-charcoal transition-all text-[9px] font-bold">{n.l}</button>
          ))}
        </div>
        <span className="text-[9px] font-mono text-charcoal-lighter ml-auto">{crop.x}%, {crop.y}%</span>
      </div>

      <p className="text-[9px] text-charcoal-lighter">Drag to pan, scroll to zoom. Controls how the image is cropped in listings.</p>
    </div>
  );
}
