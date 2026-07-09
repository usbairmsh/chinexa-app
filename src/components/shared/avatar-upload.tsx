"use client";

import { useState, useRef, useCallback } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Camera, Loader2, ZoomIn, ZoomOut, Check, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedImageBlob } from "@/lib/crop-image";
import { AvatarViewDialog } from "@/components/shared/avatar-view-dialog";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  currentUrl?: string | null;
  name?: string;
  fallback: React.ReactNode;
  onUploaded: (url: string) => void;
  size?: number;
}

/**
 * Profile picture upload: pick a file → drag to reposition / scroll or pinch
 * to zoom within a circular crop frame → crop is baked into a single
 * <=5MB JPEG client-side (re-encoding at lower quality if the first pass is
 * still too big) → uploaded via the existing /api/upload avatars folder.
 */
export function AvatarUpload({ currentUrl, name = "Profile", fallback, onUploaded, size = 96 }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    setError("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    const reader = new FileReader();
    reader.onload = () => { setRawImage(reader.result as string); setCropOpen(true); };
    reader.readAsDataURL(file);
    // Allow re-selecting the same file later (input keeps the previous value otherwise)
    e.target.value = "";
  };

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handleSaveCrop = async () => {
    if (!rawImage || !croppedArea) return;
    setSaving(true);
    setError("");
    try {
      const blob = await getCroppedImageBlob(rawImage, croppedArea);
      const formData = new FormData();
      formData.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      formData.append("folder", "avatars");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error("Upload failed — server returned an unexpected response");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      onUploaded(data.url);
      setCropOpen(false);
      setRawImage(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative shrink-0" style={{ height: size, width: size }}>
        <button
          type="button"
          onClick={() => (currentUrl ? setViewOpen(true) : fileRef.current?.click())}
          className="group relative block h-full w-full rounded-full"
          aria-label={currentUrl ? "View profile picture" : "Add profile picture"}
        >
          <div className={cn("h-full w-full rounded-full overflow-hidden ring-4 ring-primary-light shadow-lg", currentUrl && "bg-pearl")}>
            {currentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              fallback
            )}
          </div>
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-charcoal/0 group-hover:bg-charcoal/40 transition-colors">
            {currentUrl ? (
              <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            ) : (
              <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        </button>

        {/* Separate change-photo control — kept distinct from the click-to-view
            avatar above so the two actions never conflict on the same click target. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-white ring-2 ring-white shadow-md hover:bg-secondary-dark transition-colors"
          aria-label="Change profile picture"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={handleFileSelect} className="hidden" />

      <AvatarViewDialog open={viewOpen} onOpenChange={setViewOpen} imageUrl={currentUrl || ""} name={name} />

      <Dialog open={cropOpen} onOpenChange={(open) => { if (!saving) { setCropOpen(open); if (!open) setRawImage(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust your photo</DialogTitle>
            <DialogDescription>Drag to reposition, and use the slider to zoom.</DialogDescription>
          </DialogHeader>

          {rawImage && (
            <div className="relative h-72 w-full rounded-xl overflow-hidden bg-charcoal/90">
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}

          <div className="flex items-center gap-3 px-1">
            <ZoomOut className="h-4 w-4 text-charcoal-lighter shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-secondary"
              aria-label="Zoom"
            />
            <ZoomIn className="h-4 w-4 text-charcoal-lighter shrink-0" />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCropOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="secondary" className="!text-white" onClick={handleSaveCrop} disabled={saving || !croppedArea}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {saving ? "Saving..." : "Save Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
