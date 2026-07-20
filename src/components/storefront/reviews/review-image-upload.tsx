"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 5;

interface ReviewImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  className?: string;
}

/** Multi-image picker for the customer-facing "write a review" form — reuses the same /api/upload contract the admin single-image widget uses, just with folder="reviews" and up to 5 files. */
export function ReviewImageUpload({ value, onChange, className }: ReviewImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const remainingSlots = MAX_IMAGES - value.length;

  const uploadFiles = async (files: FileList) => {
    const selected = Array.from(files).slice(0, remainingSlots);
    if (selected.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        if (!file.type.startsWith("image/")) { setError("Only image files can be attached"); continue; }
        if (file.size > 5 * 1024 * 1024) { setError("Each image must be under 5MB"); continue; }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "reviews");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to upload an image"); continue; }
        uploaded.push(data.url);
      }
      if (uploaded.length > 0) onChange([...value, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/30 bg-pearl shrink-0">
            <Image src={url} alt={`Review photo ${i + 1}`} fill className="object-cover" sizes="64px" unoptimized={url.includes("/uploads/")} />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}

        {remainingSlots > 0 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-border/40 bg-pearl/30 text-charcoal-lighter hover:border-secondary/40 hover:bg-primary-light/20 hover:text-secondary transition-all shrink-0 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            <span className="text-[8px] font-medium">{uploading ? "..." : "Add"}</span>
          </button>
        )}
      </div>

      <p className="text-[10px] text-charcoal-lighter">
        {value.length}/{MAX_IMAGES} photos &middot; PNG, JPG, WebP &middot; Max 5MB each
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
