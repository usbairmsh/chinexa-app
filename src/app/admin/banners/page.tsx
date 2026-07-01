"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Plus, Edit, Trash2, MoreHorizontal, ExternalLink, Loader2, ImageIcon, AlertTriangle, Move, ZoomIn, ZoomOut, Info, RotateCcw } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Banner, BannerCrop } from "@/types/banner";

// ─── Helpers ──────────────────────────────────────────────
function parseCrop(val?: string): BannerCrop {
  if (!val) return { x: 50, y: 50, zoom: 1 };
  try {
    const parsed = JSON.parse(val);
    return { x: parsed.x ?? 50, y: parsed.y ?? 50, zoom: parsed.zoom ?? 1 };
  } catch {
    // Legacy "50% 50%" format
    const parts = (val || "").replace(/%/g, "").split(/\s+/).map(Number);
    return { x: parts[0] || 50, y: parts[1] || 50, zoom: 1 };
  }
}

function cropToString(crop: BannerCrop): string {
  return JSON.stringify({ x: crop.x, y: crop.y, zoom: crop.zoom });
}

// ─── Image Position Editor ────────────────────────────────
function ImagePositionEditor({ imageUrl, crop, onChange }: { imageUrl: string; crop: BannerCrop; onChange: (c: BannerCrop) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

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
      // Invert: dragging right moves image left (position decreases)
      const nx = Math.round(Math.max(0, Math.min(100, dragStart.current.cx - dx)));
      const ny = Math.round(Math.max(0, Math.min(100, dragStart.current.cy - dy)));
      onChange({ ...crop, x: nx, y: ny });
    };
    const onUp = () => { setDragging(false); dragStart.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, crop, onChange]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.round(Math.max(1, Math.min(3, crop.zoom + delta)) * 100) / 100;
    onChange({ ...crop, zoom: newZoom });
  };

  const adjustZoom = (delta: number) => {
    const newZoom = Math.round(Math.max(1, Math.min(3, crop.zoom + delta)) * 100) / 100;
    onChange({ ...crop, zoom: newZoom });
  };

  const nudge = (dx: number, dy: number) => {
    onChange({
      ...crop,
      x: Math.max(0, Math.min(100, crop.x + dx)),
      y: Math.max(0, Math.min(100, crop.y + dy)),
    });
  };

  const reset = () => onChange({ x: 50, y: 50, zoom: 1 });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-charcoal-light flex items-center gap-1.5">
          <Move className="h-3.5 w-3.5 text-secondary" /> Image Position & Zoom
        </label>
        <button type="button" onClick={reset} className="flex items-center gap-1 text-[10px] text-charcoal-lighter hover:text-secondary transition-colors">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {/* Preview — shows the image as it will appear in the banner */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        className={cn(
          "relative aspect-[16/7] rounded-xl overflow-hidden border-2 transition-colors select-none",
          dragging ? "border-secondary cursor-grabbing" : "border-border/30 hover:border-secondary/40 cursor-grab"
        )}
      >
        <Image
          src={imageUrl}
          alt="Position preview"
          fill
          className="object-cover pointer-events-none"
          style={{
            objectPosition: `${crop.x}% ${crop.y}%`,
            transform: `scale(${crop.zoom})`,
            transformOrigin: `${crop.x}% ${crop.y}%`,
          }}
          sizes="600px"
          unoptimized
        />
        {/* Center guide */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/10" />
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white/10" />
        </div>
        {/* Drag hint */}
        {!dragging && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/40 backdrop-blur-sm text-white text-[10px] font-medium px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              Drag to reposition
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-pearl/60 rounded-lg p-0.5">
          <button type="button" onClick={() => adjustZoom(-0.1)} disabled={crop.zoom <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white text-charcoal-lighter hover:text-charcoal disabled:opacity-30 transition-all">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-charcoal-lighter w-10 text-center">{Math.round(crop.zoom * 100)}%</span>
          <button type="button" onClick={() => adjustZoom(0.1)} disabled={crop.zoom >= 3}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white text-charcoal-lighter hover:text-charcoal disabled:opacity-30 transition-all">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Position nudge */}
        <div className="flex items-center gap-0.5 bg-pearl/60 rounded-lg p-0.5">
          <button type="button" onClick={() => nudge(-5, 0)} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white text-charcoal-lighter hover:text-charcoal transition-all text-[10px] font-bold">
            ←
          </button>
          <button type="button" onClick={() => nudge(0, -5)} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white text-charcoal-lighter hover:text-charcoal transition-all text-[10px] font-bold">
            ↑
          </button>
          <button type="button" onClick={() => nudge(0, 5)} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white text-charcoal-lighter hover:text-charcoal transition-all text-[10px] font-bold">
            ↓
          </button>
          <button type="button" onClick={() => nudge(5, 0)} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white text-charcoal-lighter hover:text-charcoal transition-all text-[10px] font-bold">
            →
          </button>
        </div>

        {/* Position readout */}
        <span className="text-[10px] font-mono text-charcoal-lighter ml-auto">
          pos: {crop.x}%, {crop.y}%
        </span>
      </div>

      <p className="text-[10px] text-charcoal-lighter">Drag to pan, scroll to zoom, or use controls. This sets which part of the image is visible in the banner.</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formMobileImage, setFormMobileImage] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formCta, setFormCta] = useState("");
  const [formPosition, setFormPosition] = useState<"hero" | "promo" | "category" | "popup">("hero");
  const [formActive, setFormActive] = useState(true);
  const [formCrop, setFormCrop] = useState<BannerCrop>({ x: 50, y: 50, zoom: 1 });

  const fetchBanners = async () => {
    try {
      const res = await fetch("/api/banners?all=1");
      const data = await res.json();
      setBanners(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchBanners(); }, []);

  const resetForm = () => {
    setFormTitle(""); setFormSubtitle(""); setFormImage(""); setFormMobileImage("");
    setFormLink(""); setFormCta(""); setFormPosition("hero"); setFormActive(true);
    setFormCrop({ x: 50, y: 50, zoom: 1 }); setEditBanner(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (banner: Banner) => {
    setEditBanner(banner);
    setFormTitle(banner.title);
    setFormSubtitle(banner.subtitle || "");
    setFormImage(banner.image);
    setFormMobileImage(banner.mobile_image || "");
    setFormLink(banner.link || "");
    setFormCta(banner.cta_text || "");
    setFormPosition(banner.position);
    setFormActive(banner.is_active);
    setFormCrop(parseCrop(banner.focal_point));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formImage.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(), subtitle: formSubtitle.trim() || null,
        image: formImage, mobile_image: formMobileImage || null,
        link: formLink.trim() || null, cta_text: formCta.trim() || null,
        position: formPosition, is_active: formActive,
        focal_point: cropToString(formCrop),
      };
      if (editBanner) {
        await fetch(`/api/banners/${editBanner.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setDialogOpen(false);
      resetForm();
      fetchBanners();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch(`/api/banners/${deleteDialog.id}`, { method: "DELETE" }).catch(() => {});
    setBanners((prev) => prev.filter((b) => b.id !== deleteDialog.id));
    setDeleteDialog(null);
  };

  const handleToggleActive = async (banner: Banner) => {
    const newActive = !banner.is_active;
    await fetch(`/api/banners/${banner.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: newActive }) }).catch(() => {});
    setBanners((prev) => prev.map((b) => b.id === banner.id ? { ...b, is_active: newActive } : b));
  };

  const activeBanners = banners.filter((b) => b.is_active);
  const heroBanners = banners.filter((b) => b.position === "hero");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Banners</h1>
          <p className="text-sm text-charcoal-lighter">{banners.length} banner{banners.length !== 1 ? "s" : ""} · {activeBanners.length} active · {heroBanners.length} hero</p>
        </div>
        <AdminButton onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Banner</AdminButton>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => (<Card key={i}><CardContent className="p-0"><Skeleton className="aspect-[16/7] rounded-t-luxury" /><div className="p-3"><Skeleton className="h-4 w-32" /></div></CardContent></Card>))}</div>
      ) : banners.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No banners yet" description="Create your first banner to display on the storefront." actionLabel="Add Banner" onAction={openCreate} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {banners.map((banner) => {
            const crop = parseCrop(banner.focal_point);
            return (
              <Card key={banner.id} className={cn("overflow-hidden transition-opacity", !banner.is_active && "opacity-60")}>
                <CardContent className="p-0">
                  <div className="relative aspect-[16/7]">
                    <Image src={banner.image} alt={banner.title} fill className="object-cover"
                      style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }}
                      sizes="(max-width: 640px) 100vw, 50vw" unoptimized={banner.image.includes("/uploads/")} />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-white font-medium text-sm truncate">{banner.title}</h3>
                      {banner.subtitle && <p className="text-white/70 text-xs truncate">{banner.subtitle}</p>}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <Badge variant={banner.is_active ? "success" : "destructive"} className="text-[10px]">{banner.is_active ? "Active" : "Inactive"}</Badge>
                      <Badge variant="outline" className="text-[10px] bg-white/80 backdrop-blur-sm capitalize">{banner.position}</Badge>
                    </div>
                    {banner.cta_text && <div className="absolute bottom-3 right-3"><Badge variant="outline" className="text-[9px] bg-white/90 text-charcoal">{banner.cta_text}</Badge></div>}
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-charcoal-lighter truncate min-w-0">
                      {banner.link ? <span className="flex items-center gap-1 truncate"><ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{banner.link}</span></span> : <span className="text-charcoal-lighter/50">No link</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={banner.is_active} onCheckedChange={() => handleToggleActive(banner)} />
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="p-1 hover:bg-pearl rounded-md">
                            <MoreHorizontal className="h-4 w-4 text-charcoal-lighter" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[100]">
                          <DropdownMenuItem onSelect={() => openEdit(banner)}><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteDialog(banner)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editBanner ? "Edit Banner" : "Add Banner"}</DialogTitle>
            <DialogDescription>{editBanner ? "Update banner details" : "Create a new promotional banner"}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 py-2 pr-1">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Title *" placeholder="Summer Glow Collection" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              <Input label="Subtitle" placeholder="Discover radiance with our new arrivals" value={formSubtitle} onChange={(e) => setFormSubtitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <ImageUpload label="Banner Image *" value={formImage} onChange={setFormImage} aspectRatio="video" placeholder="Upload banner image" folder="banners" />
              <div className="flex items-start gap-1.5 px-1"><Info className="h-3 w-3 text-charcoal-lighter shrink-0 mt-0.5" /><p className="text-[10px] text-charcoal-lighter leading-tight">Recommended: <span className="font-semibold">1920 x 800px</span>. Larger images can be repositioned below.</p></div>
            </div>
            {formImage && <ImagePositionEditor imageUrl={formImage} crop={formCrop} onChange={setFormCrop} />}
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Link URL" placeholder="/collections/new-arrivals" value={formLink} onChange={(e) => setFormLink(e.target.value)} />
              <Input label="CTA Button Text" placeholder="Shop Now" value={formCta} onChange={(e) => setFormCta(e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Position</label>
                <Select value={formPosition} onValueChange={(v) => setFormPosition(v as typeof formPosition)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero">Hero (Main Slider)</SelectItem>
                    <SelectItem value="promo">Promo Banner</SelectItem>
                    <SelectItem value="category">Category Banner</SelectItem>
                    <SelectItem value="popup">Popup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                  <span className="text-sm font-medium text-charcoal-light">{formActive ? "Active — visible on storefront" : "Inactive — hidden"}</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving || !formTitle.trim() || !formImage.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editBanner ? "Save Changes" : "Create Banner"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Banner</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteDialog && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-pearl/60">
              <div className="relative h-14 w-24 rounded-lg overflow-hidden bg-pearl shrink-0"><Image src={deleteDialog.image} alt={deleteDialog.title} fill className="object-cover" sizes="96px" unoptimized={deleteDialog.image.includes("/uploads/")} /></div>
              <div className="min-w-0"><p className="text-sm font-medium text-charcoal truncate">{deleteDialog.title}</p><p className="text-xs text-charcoal-lighter capitalize">{deleteDialog.position} banner</p></div>
            </div>
          )}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
