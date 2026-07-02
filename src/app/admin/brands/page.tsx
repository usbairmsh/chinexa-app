"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Edit, Trash2, MoreHorizontal, Loader2, AlertTriangle, Save, X, Globe, Award, Package, Home } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { CountrySearch } from "@/components/admin/shared/country-search";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, slugify } from "@/lib/utils";

interface Brand {
  id: string; name: string; slug: string; logo?: string; country?: string;
  description?: string; website?: string; certifications: string[];
  is_active: boolean; show_on_homepage: boolean; product_count: number; created_at: string;
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [fName, setFName] = useState("");
  const [fSlug, setFSlug] = useState("");
  const [fLogo, setFLogo] = useState("");
  const [fCountry, setFCountry] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fWebsite, setFWebsite] = useState("");
  const [fCerts, setFCerts] = useState<string[]>([""]);
  const [fActive, setFActive] = useState(true);
  const [fHomepage, setFHomepage] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/brands");
      const data = await res.json();
      if (Array.isArray(data)) setBrands(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchBrands(); }, []);

  const resetForm = () => {
    setFName(""); setFSlug(""); setFLogo(""); setFCountry(""); setFDesc("");
    setFWebsite(""); setFCerts([""]); setFActive(true); setFHomepage(false); setAutoSlug(true);
    setEditBrand(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (brand: Brand) => {
    setEditBrand(brand);
    setFName(brand.name); setFSlug(brand.slug); setFLogo(brand.logo || "");
    setFCountry(brand.country || ""); setFDesc(brand.description || "");
    setFWebsite(brand.website || "");
    setFCerts(brand.certifications.length > 0 ? brand.certifications : [""]);
    setFActive(brand.is_active); setFHomepage(brand.show_on_homepage); setAutoSlug(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!fName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: fName.trim(), slug: fSlug.trim() || slugify(fName),
        logo: fLogo || null, country: fCountry || null, description: fDesc.trim() || null,
        website: fWebsite.trim() || null, certifications: fCerts.filter((c) => c.trim()),
        is_active: fActive, show_on_homepage: fHomepage,
      };
      if (editBrand) {
        await fetch(`/api/brands/${editBrand.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setDialogOpen(false); resetForm(); fetchBrands();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch(`/api/brands/${deleteDialog.id}`, { method: "DELETE" });
    setDeleteDialog(null); fetchBrands();
  };

  const handleToggle = async (brand: Brand) => {
    await fetch(`/api/brands/${brand.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !brand.is_active }) });
    fetchBrands();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Brands</h1>
          <p className="text-sm text-charcoal-lighter">{brands.length} brand{brands.length !== 1 ? "s" : ""}</p>
        </div>
        <AdminButton onClick={openCreate}><Plus className="h-4 w-4" /> Add Brand</AdminButton>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
        </div>
      ) : brands.length === 0 ? (
        <EmptyState icon={Award} title="No brands yet" description="Add your first brand to organize products." actionLabel="Add Brand" onAction={openCreate} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <Card key={brand.id} className={cn("transition-opacity", !brand.is_active && "opacity-60")}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {brand.logo ? (
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-pearl border border-border/20 shrink-0">
                        <Image src={brand.logo} alt={brand.name} fill className="object-contain p-1" sizes="48px" unoptimized={brand.logo.includes("/uploads/")} />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-pearl flex items-center justify-center shrink-0">
                        <Award className="h-5 w-5 text-charcoal-lighter" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-charcoal">{brand.name}</h3>
                      {brand.country && <p className="text-[10px] text-charcoal-lighter">{brand.country}</p>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-1 hover:bg-pearl rounded-md"><MoreHorizontal className="h-4 w-4 text-charcoal-lighter" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(brand)}><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(brand)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {brand.show_on_homepage && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20"><Home className="h-2.5 w-2.5 mr-0.5" /> Homepage</Badge>}
                  {brand.certifications.map((c, i) => <Badge key={i} variant="outline" className="text-[9px]">{c}</Badge>)}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/30">
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3 text-charcoal-lighter" />
                    <span className="text-[10px] text-charcoal-lighter">{brand.product_count} products</span>
                  </div>
                  <Switch checked={brand.is_active} onCheckedChange={() => handleToggle(brand)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editBrand ? "Edit Brand" : "Add Brand"}</DialogTitle>
            <DialogDescription>{editBrand ? "Update brand details" : "Add a new brand to your store"}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <Input label="Brand Name *" value={fName} onChange={(e) => { setFName(e.target.value); if (autoSlug) setFSlug(slugify(e.target.value)); }} placeholder="e.g., CosRX" />
            <Input label="URL Slug" value={fSlug} onChange={(e) => { setFSlug(e.target.value); setAutoSlug(false); }} placeholder="cosrx" />
            <ImageUpload label="Brand Logo" value={fLogo} onChange={setFLogo} aspectRatio="square" folder="brands" />
            <CountrySearch value={fCountry} onChange={setFCountry} />
            <Textarea label="Description" value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Brief brand story..." className="min-h-[60px]" />
            <Input label="Website" value={fWebsite} onChange={(e) => setFWebsite(e.target.value)} placeholder="https://www.cosrx.com" />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-charcoal-lighter">Certifications</label>
                <button type="button" onClick={() => setFCerts([...fCerts, ""])} className="text-[10px] text-secondary hover:text-secondary-dark font-medium">+ Add</button>
              </div>
              <div className="space-y-2">
                {fCerts.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={c} onChange={(e) => { const n = [...fCerts]; n[i] = e.target.value; setFCerts(n); }} placeholder="e.g., Cruelty-Free, Halal, Vegan" className="flex-1" />
                    {fCerts.length > 1 && <button type="button" onClick={() => setFCerts(fCerts.filter((_, idx) => idx !== i))} className="p-2 text-charcoal-lighter hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={fActive} onCheckedChange={setFActive} />
                <label className="text-sm text-charcoal-lighter">Active</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={fHomepage} onCheckedChange={setFHomepage} />
                <label className="text-sm text-charcoal-lighter flex items-center gap-1"><Home className="h-3 w-3" /> Show on Homepage</label>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-3">
            <AdminButton variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</AdminButton>
            <AdminButton size="sm" onClick={handleSave} disabled={saving || !fName.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {editBrand ? "Update" : "Create"} Brand
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Brand</DialogTitle>
            <DialogDescription>Products with this brand will become unbranded. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="outline" size="sm" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" size="sm" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
