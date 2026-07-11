"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, Edit, Trash2, MoreHorizontal, FolderTree, Check, AlertTriangle, Eye, EyeOff, Globe, Tag, Sparkles, ChevronUp, ChevronDown, X, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { BrandMultiSelect } from "@/components/admin/shared/brand-multi-select";
import { useCategories } from "@/hooks/queries/use-categories";
import { useCategoriesStore } from "@/stores/categories.store";
import { slugify, cn } from "@/lib/utils";
import type { Category } from "@/types/category";

export default function AdminCategoriesPage() {
  const { data: seedCategories, isLoading } = useCategories();
  const {
    customCategories, addCategory, removeCategory, toggleCategory,
    toggleSeedCategory, isSeedHidden, categoryOrder, reorderCategories
  } = useCategoriesStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [seedDeleted, setSeedDeleted] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Category | null>(null);
  const [saved, setSaved] = useState(false);

  // Form
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [showInTopbar, setShowInTopbar] = useState(true);
  const [autoSlug, setAutoSlug] = useState(true);
  const [formBrandIds, setFormBrandIds] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/brands").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAllBrands(data.filter((b: Record<string, unknown>) => b.is_active).map((b: Record<string, unknown>) => ({ id: b.id as string, name: b.name as string })));
    }).catch(() => {});
  }, []);

  const toggleFormBrand = (id: string) => {
    setFormBrandIds((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
  };

  const handleNameChange = (val: string) => { setFormName(val); if (autoSlug) setFormSlug(slugify(val)); };
  const resetForm = () => { setEditCategory(null); setFormName(""); setFormSlug(""); setFormDesc(""); setFormImage(""); setFormParentId(""); setShowInTopbar(true); setAutoSlug(true); setFormBrandIds([]); };

  const openEdit = (cat: Category) => {
    setEditCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDesc(cat.description || "");
    setFormImage(cat.image || "");
    setFormParentId(cat.parent_id || "");
    setShowInTopbar(cat.is_active);
    setAutoSlug(false);
    setFormBrandIds(Array.isArray((cat as unknown as { brand_ids?: string[] }).brand_ids) ? (cat as unknown as { brand_ids: string[] }).brand_ids : []);
    setDialogOpen(true);
  };

  const openEditSub = (sub: { id: string; name: string; slug?: string; description?: string; parent_id?: string; product_count: number }) => {
    setEditCategory(sub as Category);
    setFormName(sub.name);
    setFormSlug(sub.slug || slugify(sub.name));
    setFormDesc(sub.description || "");
    setFormImage("");
    setFormParentId(sub.parent_id || "");
    setShowInTopbar(true);
    setAutoSlug(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const slug = formSlug.trim() || slugify(formName);
    try {
      let res: Response;
      if (editCategory) {
        // Update existing
        res = await fetch(`/api/categories/${editCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), slug, description: formDesc.trim(), image: formImage || null, is_active: showInTopbar, brand_ids: formBrandIds }),
        });
      } else {
        // Create new
        res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), slug, description: formDesc.trim(), image: formImage, parent_id: formParentId || null, is_active: showInTopbar, brand_ids: formBrandIds }),
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to save category");
        return; // do NOT reload — keep the form so the edit isn't silently lost
      }
      setDialogOpen(false); resetForm(); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      window.location.reload();
    } catch {
      alert("Network error — category not saved");
    }
  };

  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deleteDialog) return;
    setDeleteLoading(true);
    try {
      // Delete from database
      await fetch(`/api/categories/${deleteDialog.id}`, { method: "DELETE" });
      // Also remove from local store if it's a custom category
      if (deleteDialog.id.startsWith("custom-")) removeCategory(deleteDialog.id);
      // Remove from local categories list
      setSeedDeleted((prev) => [...prev, deleteDialog.id]);
      setDeleteDialog(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setDeleteLoading(false); }
  };

  const isCategoryVisible = (cat: Category) => {
    if (cat.id.startsWith("custom-")) return cat.is_active;
    return mounted ? !isSeedHidden(cat.id) : true;
  };

  // Merge and sort categories by persisted order
  const allCategoriesUnsorted: Category[] = [...(seedCategories || []), ...(mounted ? customCategories : [])].filter((c) => !seedDeleted.includes(c.id));

  const allCategories = useCallback(() => {
    if (!mounted || categoryOrder.length === 0) return allCategoriesUnsorted;
    const orderMap = new Map(categoryOrder.map((id, i) => [id, i]));
    return [...allCategoriesUnsorted].sort((a, b) => {
      const oa = orderMap.get(a.id) ?? 999;
      const ob = orderMap.get(b.id) ?? 999;
      return oa - ob;
    });
  }, [allCategoriesUnsorted, categoryOrder, mounted])();

  // Initialize order if empty — also sync to DB
  useEffect(() => {
    if (mounted && categoryOrder.length === 0 && allCategoriesUnsorted.length > 0) {
      const ids = allCategoriesUnsorted.map((c) => c.id);
      reorderCategories(ids);
      fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }).catch(() => {});
    }
  }, [mounted, categoryOrder.length, allCategoriesUnsorted, reorderCategories]);

  const moveCategory = (id: string, direction: "up" | "down") => {
    const ids = allCategories.map((c) => c.id);
    const idx = ids.indexOf(id);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === ids.length - 1)) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    reorderCategories(ids);
    // Persist to database
    fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  const moveSubcategory = async (parentCat: Category, subIdx: number, direction: "up" | "down") => {
    if (!parentCat.children || parentCat.children.length < 2) return;
    const swapIdx = direction === "up" ? subIdx - 1 : subIdx + 1;
    if (swapIdx < 0 || swapIdx >= parentCat.children.length) return;

    const children = [...parentCat.children];
    [children[subIdx], children[swapIdx]] = [children[swapIdx], children[subIdx]];

    // Update order in database for each subcategory
    try {
      await Promise.all(
        children.map((child, i) =>
          fetch(`/api/categories/${child.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: i }),
          })
        )
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      window.location.reload();
    } catch {}
  };

  const visibleCount = allCategories.filter((c) => isCategoryVisible(c)).length;
  const hiddenCount = allCategories.length - visibleCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Categories</h1>
          <p className="text-sm text-charcoal-lighter">{visibleCount} visible{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}</p>
        </div>
        <AdminButton onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4" /> Add Category</AdminButton>
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
            <Check className="h-4 w-4" /> Changes saved and applied to storefront, topbar, and database.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category List */}
      <div className="grid gap-2">
        {isLoading ? Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><div className="h-12 bg-pearl rounded-lg animate-pulse" /></CardContent></Card>
        )) : (
          <AnimatePresence>
            {allCategories.map((cat, index) => {
              const isCustom = cat.id.startsWith("custom-");
              const visible = isCategoryVisible(cat);
              return (
                <motion.div key={cat.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}>
                  <Card className={cn(!visible && "opacity-50")}>
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 p-3 sm:p-4">
                        {/* Sort Buttons */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={() => moveCategory(cat.id, "up")}
                            disabled={index === 0}
                            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-pearl disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp className="h-3.5 w-3.5 text-charcoal-lighter" />
                          </button>
                          <button
                            onClick={() => moveCategory(cat.id, "down")}
                            disabled={index === allCategories.length - 1}
                            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-pearl disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown className="h-3.5 w-3.5 text-charcoal-lighter" />
                          </button>
                        </div>

                        {/* Image */}
                        <div className="relative h-11 w-11 rounded-xl overflow-hidden bg-pearl shrink-0">
                          <Image src={cat.image || `https://picsum.photos/seed/cat-${cat.slug}/100/100`} alt={cat.name} fill className="object-cover" sizes="44px" unoptimized={cat.image?.startsWith("data:")} />
                          {!visible && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><EyeOff className="h-3.5 w-3.5 text-charcoal-lighter" /></div>}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-medium text-charcoal text-sm">{cat.name}</h3>
                            {isCustom && <Badge variant="new" className="text-[8px]">Custom</Badge>}
                            {!visible && <Badge variant="destructive" className="text-[8px]">Hidden</Badge>}
                          </div>
                          <p className="text-[10px] text-charcoal-lighter truncate mt-0.5">/{cat.slug} · {cat.product_count} products</p>
                        </div>

                        {/* Toggle */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] text-charcoal-lighter hidden sm:block">{visible ? "Topbar" : "Off"}</span>
                          <Switch checked={visible} onCheckedChange={() => isCustom ? toggleCategory(cat.id) : toggleSeedCategory(cat.id)} />
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1.5 hover:bg-pearl rounded-lg transition-colors shrink-0">
                            <MoreHorizontal className="h-4 w-4 text-charcoal-lighter" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(cat)}><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => isCustom ? toggleCategory(cat.id) : toggleSeedCategory(cat.id)}>
                              {visible ? <><EyeOff className="h-3.5 w-3.5 mr-2" /> Hide from Topbar</> : <><Eye className="h-3.5 w-3.5 mr-2" /> Show in Topbar</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { resetForm(); setFormParentId(cat.id); setDialogOpen(true); }}>
                              <Plus className="h-3.5 w-3.5 mr-2" /> Add Subcategory
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(cat)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {cat.children && cat.children.length > 0 && (
                        <div className="border-t border-border/15 bg-pearl/20 px-3 py-2.5">
                          <div className="flex flex-col gap-1 ml-8 sm:ml-14">
                            {cat.children.map((sub, subIdx) => (
                              <div key={sub.id} className="flex items-center gap-1.5 group flex-wrap">
                                {/* Subcategory sort buttons */}
                                <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); moveSubcategory(cat, subIdx, "up"); }}
                                    disabled={subIdx === 0}
                                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-white disabled:opacity-20 transition-colors"
                                  >
                                    <ChevronUp className="h-3 w-3 text-charcoal-lighter" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); moveSubcategory(cat, subIdx, "down"); }}
                                    disabled={subIdx === cat.children!.length - 1}
                                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-white disabled:opacity-20 transition-colors"
                                  >
                                    <ChevronDown className="h-3 w-3 text-charcoal-lighter" />
                                  </button>
                                </div>
                                <span
                                  className="flex items-center gap-1 rounded-full bg-white border border-border/30 px-2.5 py-1 text-[10px] cursor-pointer hover:border-secondary/30 transition-colors"
                                  onClick={() => openEditSub({ ...sub, parent_id: cat.id })}
                                >
                                  <FolderTree className="h-2.5 w-2.5 text-secondary" />
                                  <span className="font-medium">{sub.name}</span>
                                  <span className="text-charcoal-lighter">({sub.product_count})</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEditSub({ ...sub, parent_id: cat.id }); }}
                                    className="ml-0.5 text-charcoal-lighter/50 hover:text-secondary transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Edit className="h-2.5 w-2.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteDialog(sub as Category); }}
                                    className="text-charcoal-lighter/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Associated Brands */}
                      {(() => {
                        const catBrands: { id: string; name: string; product_count: number }[] = Array.isArray((cat as unknown as { brands?: { id: string; name: string; product_count: number }[] }).brands) ? (cat as unknown as { brands: { id: string; name: string; product_count: number }[] }).brands : [];
                        if (catBrands.length === 0) return null;
                        const catBrandIds: string[] = catBrands.map((b) => b.id);
                        return (
                          <div className="border-t border-border/15 bg-blue-50/30 px-3 py-2.5">
                            <p className="text-[9px] font-semibold text-charcoal-lighter uppercase tracking-wider ml-8 sm:ml-14 mb-1.5">Brands</p>
                            <div className="flex flex-col gap-1 ml-8 sm:ml-14">
                              {catBrands.map((brand) => (
                                <div key={brand.id} className="flex items-center gap-1.5 group">
                                  <span className="flex items-center gap-1 rounded-full bg-white border border-blue-200/50 px-2.5 py-1 text-[10px] cursor-pointer hover:border-secondary/30 transition-colors">
                                    <Award className="h-2.5 w-2.5 text-blue-500" />
                                    <span className="font-medium">{brand.name}</span>
                                    <span className="text-charcoal-lighter">({brand.product_count})</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); const next = catBrandIds.filter((id) => id !== brand.id); fetch(`/api/categories/${cat.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_ids: next }) }).then((r) => { if (r.ok) window.location.reload(); else alert("Failed to remove brand"); }).catch(() => alert("Network error")); }}
                                      className="text-charcoal-lighter/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ═══════ CREATE CATEGORY MODAL — Responsive ═══════ */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="w-[95vw] max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary-light to-pearl px-5 sm:px-6 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10 shrink-0">
                <FolderTree className="h-4 w-4 text-secondary" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg">{editCategory ? `Edit ${formParentId ? "Subcategory" : "Category"}` : formParentId ? "Add Subcategory" : "Create Category"}</DialogTitle>
                <DialogDescription className="text-[11px]">{editCategory ? `Update ${editCategory.name}` : formParentId ? `Under ${allCategories.find((c) => c.id === formParentId)?.name || "parent"}` : "Add a new category to your store"}</DialogDescription>
              </div>
            </div>
          </div>

          {/* Scrollable Form */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            {/* Parent Category (for subcategories) */}
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Parent Category</label>
              <Select value={formParentId} onValueChange={setFormParentId}>
                <SelectTrigger><SelectValue placeholder="None (top-level category)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (top-level category)</SelectItem>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formParentId && <p className="text-[10px] text-charcoal-lighter mt-1">This will be a subcategory under {allCategories.find((c) => c.id === formParentId)?.name}</p>}
            </div>

            <Input label={formParentId ? "Subcategory Name" : "Category Name"} placeholder="e.g., Hair Care, Wellness" value={formName} onChange={(e) => handleNameChange(e.target.value)} />

            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">URL Slug</label>
              <div className="flex items-center rounded-xl border border-border overflow-hidden focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20 transition-all">
                <span className="px-2.5 text-[11px] text-charcoal-lighter bg-pearl border-r border-border h-11 flex items-center shrink-0">/categories/</span>
                <input value={formSlug} onChange={(e) => { setFormSlug(e.target.value); setAutoSlug(false); }} placeholder="hair-care" className="flex-1 h-11 px-3 text-sm text-charcoal bg-transparent outline-none min-w-0" />
              </div>
            </div>

            <Textarea label="Description" placeholder="Brief description for SEO..." value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="min-h-[70px]" />

            {!formParentId && (
              <ImageUpload label="Category Image" aspectRatio="video" value={formImage} onChange={setFormImage} folder="categories" />
            )}

            {/* Associated Brands */}
            {!formParentId && allBrands.length > 0 && (
              <BrandMultiSelect brands={allBrands} selected={formBrandIds} onToggle={toggleFormBrand} />
            )}

            <Separator />

            {/* Topbar Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-pearl/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10 shrink-0">
                  <Globe className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal"><FieldLabel label="Show in Topbar" hint="Visible in storefront nav" /></p>
                </div>
              </div>
              <Switch checked={showInTopbar} onCheckedChange={setShowInTopbar} />
            </div>

            {/* Preview */}
            {formName && (
              <div className="p-3 rounded-xl border border-border/30">
                <p className="text-[9px] text-charcoal-lighter uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-secondary" /> Preview
                </p>
                <div className="flex items-center gap-3">
                  {formImage ? (
                    <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-pearl shrink-0">
                      <Image src={formImage} alt="" fill className="object-cover" sizes="36px" unoptimized={formImage.startsWith("data:")} />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-pearl flex items-center justify-center shrink-0"><Tag className="h-3.5 w-3.5 text-charcoal-lighter" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{formName}</p>
                    <p className="text-[10px] text-charcoal-lighter truncate">/{formSlug || slugify(formName)} · {showInTopbar ? "In topbar" : "Hidden"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-3 bg-pearl/30 border-t border-border/20 flex items-center justify-end gap-2 shrink-0">
            <AdminButton variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton size="sm" onClick={handleSave} disabled={!formName.trim()}>
              {editCategory ? <><Check className="h-3.5 w-3.5" /> Save Changes</> : <><Plus className="h-3.5 w-3.5" /> Create</>}
            </AdminButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Category</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteDialog && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-pearl/60">
                <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-pearl shrink-0">
                  {deleteDialog.image ? (
                    <Image src={deleteDialog.image} alt={deleteDialog.name} fill className="object-cover" sizes="40px" unoptimized={deleteDialog.image.startsWith("data:") || deleteDialog.image.startsWith("/uploads/")} />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-charcoal-lighter"><FolderTree className="h-4 w-4" /></div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal">{deleteDialog.name}</p>
                  <p className="text-[10px] text-charcoal-lighter">/{deleteDialog.slug} · {deleteDialog.product_count} products</p>
                </div>
              </div>
              <p className="text-sm text-charcoal-light">
                Are you sure you want to delete <span className="font-semibold text-charcoal">{deleteDialog.name}</span>?
                {deleteDialog.product_count > 0 && " Products in this category will become uncategorized."}
                {" "}This will remove it from the storefront navigation and database.
              </p>
            </div>
          )}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete} disabled={deleteLoading}>
              <Trash2 className="h-3.5 w-3.5" /> {deleteLoading ? "Deleting..." : "Delete Category"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
