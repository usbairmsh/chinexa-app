"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Link2, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  aspectRatio?: "square" | "video" | "portrait";
  productId?: string;
  imageIndex?: string;
  folder?: string;
}

export function ImageUpload({
  value,
  onChange,
  label,
  placeholder = "Upload image or paste URL",
  className,
  aspectRatio = "square",
  productId,
  imageIndex,
  folder = "products",
}: ImageUploadProps) {
  const [mode, setMode] = useState<"upload" | "url">(value && value.startsWith("http") ? "url" : "upload");
  const [urlInput, setUrlInput] = useState(value?.startsWith("http") ? value : "");
  const [preview, setPreview] = useState(value || "");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const aspectClass = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
  }[aspectRatio];

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("File too large. Max 5MB"); return; }

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      if (productId) formData.append("product_id", productId);
      if (imageIndex) formData.append("image_index", imageIndex);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Upload failed — server returned an unexpected response");
      }
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      // data.url is the path like /uploads/products/prod-123_0001.jpg
      setPreview(data.url);
      onChange?.(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      // Fallback: use base64 for preview only
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreview(dataUrl);
        onChange?.(dataUrl);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      setPreview(urlInput.trim());
      onChange?.(urlInput.trim());
      setError("");
    }
  };

  const handleClear = () => {
    setPreview("");
    setUrlInput("");
    setError("");
    onChange?.("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="block text-sm font-medium text-charcoal-light">{label}</label>
      )}

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-pearl/60 p-0.5 rounded-lg w-fit mb-2">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
            mode === "upload" ? "bg-white text-charcoal shadow-card" : "text-charcoal-lighter hover:text-charcoal"
          )}
        >
          <Upload className="h-3 w-3" /> Upload
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
            mode === "url" ? "bg-white text-charcoal shadow-card" : "text-charcoal-lighter hover:text-charcoal"
          )}
        >
          <Link2 className="h-3 w-3" /> URL
        </button>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Preview or Upload Area */}
      {preview ? (
        <div className={cn("relative rounded-xl overflow-hidden bg-pearl border border-border/30", aspectClass)}>
          <Image
            src={preview}
            alt="Preview"
            fill
            className="object-cover"
            sizes="300px"
            unoptimized={preview.startsWith("data:") || preview.includes("/uploads/")}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-charcoal-lighter hover:text-destructive hover:bg-white shadow-md transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {/* Show file path */}
          {preview.includes("/uploads/") && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
              <p className="text-[9px] text-white/80 truncate">{preview}</p>
            </div>
          )}
        </div>
      ) : uploading ? (
        <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-secondary/30 bg-secondary/5", aspectClass)}>
          <Loader2 className="h-8 w-8 text-secondary animate-spin" />
          <p className="text-sm font-medium text-secondary">Uploading...</p>
        </div>
      ) : mode === "upload" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all",
            aspectClass,
            dragActive
              ? "border-secondary bg-secondary/5"
              : "border-border/40 bg-pearl/30 hover:border-secondary/40 hover:bg-primary-light/20"
          )}
        >
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            dragActive ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter"
          )}>
            <ImagePlus className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-charcoal">
              {dragActive ? "Drop image here" : "Click to upload"}
            </p>
            <p className="text-[10px] text-charcoal-lighter mt-0.5">
              or drag and drop &middot; PNG, JPG, WebP &middot; Max 5MB
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlApply()}
              placeholder={placeholder}
              className="flex-1 h-10 rounded-xl border border-border bg-white px-3 text-sm text-charcoal placeholder:text-charcoal-lighter/50 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
            />
            <button
              type="button"
              onClick={handleUrlApply}
              disabled={!urlInput.trim()}
              className="h-10 px-4 rounded-full bg-secondary text-white text-[12px] font-body font-semibold tracking-wide hover:bg-secondary-dark hover:shadow-[0_6px_30px_rgba(122,79,160,0.4)] hover:-translate-y-[1px] active:scale-[0.96] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
          <p className="text-[10px] text-charcoal-lighter">Paste a direct image URL and click Apply to preview</p>
        </div>
      )}
    </div>
  );
}
