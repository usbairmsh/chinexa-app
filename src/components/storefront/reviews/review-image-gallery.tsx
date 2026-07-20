"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

/** Thumbnail row for a review's attached photos, with a click-to-enlarge lightbox. Shared between the storefront product page and the admin reviews list so review images render identically everywhere. */
export function ReviewImageGallery({ images }: { images: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (!images || images.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setLightbox(url)}
            className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/30 bg-pearl shrink-0 hover:opacity-80 transition-opacity"
          >
            <Image src={url} alt={`Review photo ${i + 1}`} fill className="object-cover" sizes="64px" unoptimized={url.includes("/uploads/")} />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative h-[80vh] w-full max-w-2xl">
            <Image src={lightbox} alt="Review photo" fill className="object-contain" sizes="100vw" unoptimized={lightbox.includes("/uploads/")} />
          </div>
        </div>
      )}
    </>
  );
}
