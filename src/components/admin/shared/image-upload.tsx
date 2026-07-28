"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import Image from "next/image";
import { Upload, X, Link2, ImagePlus, Loader2, Check, Crop } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { getCroppedImageBlob, type Area } from "@/lib/crop-image";
import { ImageCropper } from "@/components/admin/shared/image-cropper";
import { usePendingUploadRegistration } from "@/components/admin/shared/pending-uploads";

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  label?: ReactNode;
  placeholder?: string;
  className?: string;
  aspectRatio?: "square" | "video" | "portrait";
  productId?: string;
  imageIndex?: string;
  folder?: string;
  /**
   * Enables DEFERRED upload: the picked image is previewed & cropped in the
   * browser and only uploaded when the form calls flushUploads(). `field` is
   * the key it reports its uploaded URL under. Requires a PendingUploadsProvider
   * ancestor; without one it silently falls back to immediate upload.
   */
  field?: string;
}

const CROP_ASPECT = { square: 1, video: 16 / 9, portrait: 3 / 4 } as const;

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
  field,
}: ImageUploadProps) {
  const registration = usePendingUploadRegistration();
  const deferred = !!field && !!registration;

  const [mode, setMode] = useState<"upload" | "url">(value && value.startsWith("http") ? "url" : "upload");
  const [urlInput, setUrlInput] = useState(value?.startsWith("http") ? value : "");
  const [preview, setPreview] = useState(value || "");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Deferred staging: the cropped blob waiting to be uploaded at submit, plus
  // its object-URL preview (revoked on replace/unmount to avoid leaks).
  const stagedBlob = useRef<Blob | null>(null);
  const objectUrl = useRef<string | null>(null);

  // Crop dialog state.
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  // Crop aspect preset: "" = free-form. Defaults to the field's natural ratio.
  const [cropAspect, setCropAspect] = useState<number | undefined>(CROP_ASPECT[aspectRatio]);

  const aspectClass = { square: "aspect-square", video: "aspect-video", portrait: "aspect-[3/4]" }[aspectRatio];

  const revokeObjectUrl = () => {
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; }
  };
  useEffect(() => () => revokeObjectUrl(), []);

  // ── Immediate upload path (non-deferred / storefront) ──
  const uploadNow = async (file: File | Blob, filename = "image.jpg"): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file instanceof File ? file : new File([file], filename, { type: "image/jpeg" }));
    formData.append("folder", folder);
    if (productId) formData.append("product_id", productId);
    if (imageIndex) formData.append("image_index", imageIndex);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("Upload failed — unexpected server response");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url as string;
  };

  // ── Deferred commit — uploads the staged blob at submit time ──
  const commit = useCallback(async (): Promise<string | null> => {
    if (!stagedBlob.current) return null; // nothing new staged → keep existing value
    const url = await uploadNow(stagedBlob.current, "image.jpg");
    stagedBlob.current = null;
    revokeObjectUrl();
    if (url) { setPreview(url); onChange?.(url); }
    return url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, productId, imageIndex, onChange]);

  useEffect(() => {
    if (!deferred || !field || !registration) return;
    registration.register(field, commit);
    return () => registration.unregister(field);
  }, [deferred, field, registration, commit]);

  const onFilePicked = (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 15 * 1024 * 1024) { setError("File too large. Max 15MB"); return; }
    setError("");
    setCroppedArea(null); setCropAspect(CROP_ASPECT[aspectRatio]);
    const reader = new FileReader();
    reader.onload = () => { setRawImage(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const applyCrop = async () => {
    if (!rawImage || !croppedArea) return;
    setError("");
    try {
      const blob = await getCroppedImageBlob(rawImage, croppedArea);
      if (deferred) {
        // Stage it — preview via object URL; upload happens on submit.
        revokeObjectUrl();
        stagedBlob.current = blob;
        const url = URL.createObjectURL(blob);
        objectUrl.current = url;
        setPreview(url);
        onChange?.(url); // provisional value; replaced by the real URL on flush
      } else {
        // Immediate upload (no provider / no field).
        setUploading(true);
        const url = await uploadNow(blob, "image.jpg");
        if (url) { setPreview(url); onChange?.(url); }
      }
      setCropOpen(false);
      setRawImage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process image");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      stagedBlob.current = null; revokeObjectUrl();
      setPreview(urlInput.trim());
      onChange?.(urlInput.trim());
      setError("");
    }
  };

  const handleClear = () => {
    stagedBlob.current = null; revokeObjectUrl();
    setPreview(""); setUrlInput(""); setError("");
    onChange?.("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="block text-sm font-medium text-charcoal-light">{label}</label>}

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-pearl/60 p-0.5 rounded-lg w-fit mb-2">
        <button type="button" onClick={() => setMode("upload")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all", mode === "upload" ? "bg-card text-charcoal shadow-card" : "text-charcoal-lighter hover:text-charcoal")}>
          <Upload className="h-3 w-3" /> Upload
        </button>
        <button type="button" onClick={() => setMode("url")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all", mode === "url" ? "bg-card text-charcoal shadow-card" : "text-charcoal-lighter hover:text-charcoal")}>
          <Link2 className="h-3 w-3" /> URL
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {preview ? (
        <div className={cn("relative rounded-xl overflow-hidden bg-image-surface border border-border/30", aspectClass)}>
          <Image src={preview} alt="Preview" fill className="object-cover" sizes="300px"
            unoptimized={preview.startsWith("data:") || preview.startsWith("blob:") || preview.includes("/uploads/")} />
          <div className="absolute top-2 right-2 flex gap-1.5">
            {(stagedBlob.current || preview.startsWith("blob:")) && (
              <span className="flex items-center rounded-full bg-secondary/90 px-2 py-0.5 text-[9px] font-medium text-white shadow-md">Uploads on save</span>
            )}
            <button type="button" onClick={handleClear}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-charcoal-lighter hover:text-destructive hover:bg-card shadow-md transition-all">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {preview.includes("/uploads/") && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
              <p className="text-[9px] text-white/80 truncate">{preview}</p>
            </div>
          )}
        </div>
      ) : uploading ? (
        <div className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-secondary/30 bg-secondary/5", aspectClass)}>
          <Loader2 className="h-8 w-8 text-secondary animate-spin" />
          <p className="text-sm font-medium text-secondary">Uploading…</p>
        </div>
      ) : mode === "upload" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) onFilePicked(f); }}
          onClick={() => fileRef.current?.click()}
          className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all", aspectClass,
            dragActive ? "border-secondary bg-secondary/5" : "border-border/40 bg-pearl/30 hover:border-secondary/40 hover:bg-primary-light/20")}>
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full transition-colors", dragActive ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter")}>
            <ImagePlus className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-charcoal">{dragActive ? "Drop image here" : "Click to upload"}</p>
            <p className="text-[10px] text-charcoal-lighter mt-0.5">or drag and drop &middot; PNG, JPG, WebP &middot; crop before saving</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFilePicked(f); }} className="hidden" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlApply()} placeholder={placeholder}
              className="flex-1 h-10 rounded-luxury bg-beige-dark/70 shadow-[inset_0_0_0_1px_rgba(58,36,56,0.06)] px-3 text-sm text-charcoal placeholder:text-charcoal-lighter/50 hover:bg-beige-dark focus:bg-card focus:shadow-[inset_0_0_0_1.5px_var(--color-secondary)] focus:outline-none transition-all" />
            <AdminButton size="sm" onClick={handleUrlApply} disabled={!urlInput.trim()}>Apply</AdminButton>
          </div>
          <p className="text-[10px] text-charcoal-lighter">Paste a direct image URL and click Apply to preview</p>
        </div>
      )}

      {/* Crop dialog */}
      <Dialog open={cropOpen} onOpenChange={(o) => { if (!uploading) { setCropOpen(o); if (!o) setRawImage(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crop className="h-4 w-4 text-secondary" /> Crop image</DialogTitle>
            <DialogDescription>Drag the box to move it, drag a handle to resize, then apply.</DialogDescription>
          </DialogHeader>
          {rawImage && <ImageCropper src={rawImage} aspect={cropAspect} onChange={setCroppedArea} />}
          {/* Aspect presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-charcoal-lighter">Ratio:</span>
            {([
              ["Free", undefined],
              ["Square", 1],
              ["16:9", 16 / 9],
              ["4:3", 4 / 3],
              ["3:4", 3 / 4],
            ] as const).map(([label, val]) => (
              <button
                key={label} type="button" onClick={() => setCropAspect(val)}
                className={cn("rounded-lg border px-2.5 py-1 text-xs transition-colors",
                  cropAspect === val ? "border-secondary bg-secondary/10 text-charcoal" : "border-border/50 text-charcoal-lighter hover:bg-pearl")}
              >
                {label}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => { setCropOpen(false); setRawImage(null); }} disabled={uploading}>Cancel</AdminButton>
            <AdminButton onClick={applyCrop} disabled={uploading || !croppedArea}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {deferred ? "Apply" : uploading ? "Uploading…" : "Apply & upload"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
