"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Edit, Trash2, Loader2, AlertTriangle, Lock, GripVertical,
  ChevronUp, ChevronDown, Clock, Link2, Info,
} from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";
import {
  autoTextColor, contrastRatio, slugify, validateAttachAndValidity, MAX_CARD_TAGS,
  type Tag, type TagAttachType, type TagValidityMode,
} from "@/lib/tags";

const ATTACH_LABELS: Record<TagAttachType, string> = {
  none: "Not attached",
  category: "Category",
  subcategory: "Subcategory",
  product: "Product",
  offer: "Offer",
  coupon: "Coupon",
};

const VALIDITY_LABELS: Record<TagValidityMode, string> = {
  none: "No expiry",
  date: "Until a date",
  days: "Days",
  months: "Months",
  years: "Years",
};

/** Preset swatches so the common case is one click, not a colour-picker fiddle. */
const SWATCHES = [
  "#0F9D58", "#DC2626", "#B8860B", "#7C3AED", "#E11D48",
  "#2563EB", "#0891B2", "#EA580C", "#4B5563", "#DB2777",
];

interface Option { id: string; name: string }

export default function AdminTagsPage() {
  const { can } = useAdmin();
  const canAdd = can("tags", "add");
  const canEdit = can("tags", "edit");
  const canDelete = can("tags", "delete");

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Tag | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Attach-target option lists, loaded lazily per type.
  const [categories, setCategories] = useState<Option[]>([]);
  const [subcategories, setSubcategories] = useState<Option[]>([]);
  const [offers, setOffers] = useState<Option[]>([]);
  const [coupons, setCoupons] = useState<Option[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Option[]>([]);

  // Form
  const [fLabel, setFLabel] = useState("");
  const [fSlug, setFSlug] = useState("");
  const [fColor, setFColor] = useState("#7C3AED");
  const [fAutoText, setFAutoText] = useState(true);
  const [fTextColor, setFTextColor] = useState("#FFFFFF");
  const [fAttachType, setFAttachType] = useState<TagAttachType>("none");
  const [fAttachIds, setFAttachIds] = useState<string[]>([]);
  const [fValidityMode, setFValidityMode] = useState<TagValidityMode>("none");
  const [fValidityValue, setFValidityValue] = useState("");
  const [fActive, setFActive] = useState(true);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      setListError("");
      setTags(Array.isArray(data) ? data : []);
    } catch {
      setListError("Network error — could not load tags.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  // Categories double as the subcategory source: the API returns parents with a
  // nested children[] array.
  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((data) => {
      if (!Array.isArray(data)) return;
      setCategories(data.map((c: Record<string, unknown>) => ({ id: String(c.id), name: String(c.name) })));
      const kids: Option[] = [];
      for (const c of data) {
        for (const k of (c.children as Record<string, unknown>[] | undefined) || []) {
          kids.push({ id: String(k.id), name: `${String(c.name)} › ${String(k.name)}` });
        }
      }
      setSubcategories(kids);
    }).catch(() => {});
    fetch("/api/offers").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setOffers(d.map((o: Record<string, unknown>) => ({ id: String(o.id), name: String(o.title) })));
    }).catch(() => {});
    fetch("/api/coupons").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setCoupons(d.map((c: Record<string, unknown>) => ({ id: String(c.id), name: String(c.code) })));
    }).catch(() => {});
  }, []);

  // Product search — the product list is far too large to load whole.
  useEffect(() => {
    const q = productQuery.trim();
    if (fAttachType !== "product" || q.length < 2) { setProductResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(q)}&limit=20`)
        .then((r) => r.json())
        .then((d) => {
          const list = Array.isArray(d) ? d : d?.products;
          if (Array.isArray(list)) {
            setProductResults(list.map((p: Record<string, unknown>) => ({ id: String(p.id), name: String(p.name) })));
          }
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [productQuery, fAttachType]);

  const attachOptions: Option[] = useMemo(() => {
    switch (fAttachType) {
      case "category": return categories;
      case "subcategory": return subcategories;
      case "offer": return offers;
      case "coupon": return coupons;
      case "product": return productResults;
      default: return [];
    }
  }, [fAttachType, categories, subcategories, offers, coupons, productResults]);

  const resetForm = () => {
    setFLabel(""); setFSlug(""); setFColor("#7C3AED");
    setFAutoText(true); setFTextColor("#FFFFFF");
    setFAttachType("none"); setFAttachIds([]);
    setFValidityMode("none"); setFValidityValue("");
    setFActive(true); setEditTag(null); setProductQuery(""); setProductResults([]);
  };

  const openCreate = () => { resetForm(); setFormError(""); setDialogOpen(true); };

  const openEdit = (tag: Tag) => {
    setEditTag(tag);
    setFLabel(tag.label);
    setFSlug(tag.slug);
    setFColor(tag.color);
    setFAutoText(tag.text_color === null);
    setFTextColor(tag.text_color || autoTextColor(tag.color));
    setFAttachType(tag.attach_type);
    setFAttachIds(tag.attach_ids);
    setFValidityMode(tag.validity_mode);
    setFValidityValue(tag.validity_value || "");
    setFActive(tag.is_active);
    setFormError("");
    setProductQuery(""); setProductResults([]);
    setDialogOpen(true);
  };

  // Attaching a tag clears any validity, mirroring the server-side invariant:
  // an attached tag lasts as long as what it's attached to.
  const changeAttachType = (next: TagAttachType) => {
    setFAttachType(next);
    setFAttachIds([]);
    if (next !== "none") { setFValidityMode("none"); setFValidityValue(""); }
  };

  const effectiveText = fAutoText ? autoTextColor(fColor) : fTextColor;
  const ratio = contrastRatio(fColor, effectiveText);
  const lowContrast = ratio < 4.5;

  const invariantError = validateAttachAndValidity(fAttachType, fAttachIds, fValidityMode, fValidityValue || null);
  const isFormValid = fLabel.trim().length >= 2 && !invariantError;

  const save = async () => {
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        label: fLabel.trim(),
        slug: editTag ? undefined : (fSlug.trim() || slugify(fLabel)),
        color: fColor,
        text_color: fAutoText ? null : fTextColor,
        attach_type: fAttachType,
        attach_ids: fAttachIds,
        validity_mode: fValidityMode,
        validity_value: fValidityValue || null,
        is_active: fActive,
        priority: editTag ? editTag.priority : (tags.length + 1) * 10,
      };
      const res = await fetch(editTag ? `/api/tags/${editTag.id}` : "/api/tags", {
        method: editTag ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(data?.error || "Could not save the tag."); return; }
      setDialogOpen(false);
      resetForm();
      await fetchTags();
    } catch {
      setFormError("Network error — the tag was not saved.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tags/${deleteDialog.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setListError(data?.error || "Could not delete the tag."); return; }
      setDeleteDialog(null);
      await fetchTags();
    } catch {
      setListError("Network error — the tag was not deleted.");
    } finally {
      setSaving(false);
    }
  };

  /** Persist a reordered list. Optimistic: the rows move immediately, and a
   *  failed save reloads the server's real order rather than leaving a lie on screen. */
  const persistOrder = async (next: Tag[]) => {
    setTags(next);
    try {
      const res = await fetch("/api/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((t) => t.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setListError("Could not save the new order.");
      fetchTags();
    }
  };

  const moveTo = (from: number, to: number) => {
    if (from === to || to < 0 || to >= tags.length) return;
    const next = [...tags];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Tags</h1>
          <p className="text-sm text-charcoal-light mt-1">
            Labels shown on products. Drag to set priority — a product card shows the top {MAX_CARD_TAGS} only.
          </p>
        </div>
        {canAdd && (
          <AdminButton onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Tag</AdminButton>
        )}
      </div>

      {listError && (
        <div className="mb-4 flex items-start gap-2 rounded-luxury border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{listError}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-luxury" />)}</div>
      ) : tags.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No tags yet"
          description="Create a tag to label products on the storefront."
        />
      ) : (
        <div className="space-y-2">
          {tags.map((tag, i) => {
            const text = tag.text_color || autoTextColor(tag.color);
            const withinCardCap = i < MAX_CARD_TAGS;
            return (
              <motion.div
                key={tag.id}
                layout
                draggable={canEdit}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) moveTo(dragIndex, i); setDragIndex(null); }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  "flex items-center gap-3 rounded-luxury border bg-card p-3 transition-colors",
                  dragIndex === i ? "border-secondary opacity-60" : "border-border/40"
                )}
              >
                {canEdit && <GripVertical className="h-4 w-4 shrink-0 text-charcoal-lighter cursor-grab active:cursor-grabbing" />}

                {/* Live chip — exactly how it renders on the storefront */}
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: tag.color, color: text }}
                >
                  {tag.label}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <code className="text-xs text-charcoal-light">{tag.slug}</code>
                    {tag.is_system && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-charcoal-lighter" title="Built-in tag — used by the storefront, so it can't be renamed or deleted">
                        <Lock className="h-3 w-3" /> built-in
                      </span>
                    )}
                    {!tag.is_active && <span className="text-[10px] text-charcoal-lighter">hidden</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-charcoal-lighter">
                    {tag.attach_type !== "none" && (
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        {ATTACH_LABELS[tag.attach_type]} · {tag.attach_ids.length}
                      </span>
                    )}
                    {tag.validity_mode !== "none" && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tag.validity_mode === "date"
                          ? `until ${tag.validity_value}`
                          : `${tag.validity_value} ${tag.validity_mode}`}
                      </span>
                    )}
                    {!withinCardCap && (
                      <span className="text-warning">below the top {MAX_CARD_TAGS} — won&apos;t show on cards</span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={() => moveTo(i, i - 1)} disabled={i === 0}
                      aria-label="Increase priority"
                      className="rounded-full p-1 text-charcoal-lighter transition-colors hover:bg-secondary/10 hover:text-secondary disabled:opacity-30 disabled:hover:bg-transparent">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => moveTo(i, i + 1)} disabled={i === tags.length - 1}
                      aria-label="Decrease priority"
                      className="rounded-full p-1 text-charcoal-lighter transition-colors hover:bg-secondary/10 hover:text-secondary disabled:opacity-30 disabled:hover:bg-transparent">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => openEdit(tag)} aria-label={`Edit ${tag.label}`}
                      className="rounded-full p-1 text-charcoal-lighter transition-colors hover:bg-secondary/10 hover:text-secondary">
                      <Edit className="h-4 w-4" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteDialog(tag)}
                        disabled={tag.is_system}
                        aria-label={tag.is_system ? "Built-in tags can't be deleted" : `Delete ${tag.label}`}
                        title={tag.is_system ? "Built-in tags can't be deleted — the storefront uses them" : undefined}
                        className="rounded-full p-1 text-charcoal-lighter transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-charcoal-lighter"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══ Editor ═══ */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTag ? `Edit "${editTag.label}"` : "New Tag"}</DialogTitle>
            <DialogDescription>
              {editTag?.is_system
                ? "This is a built-in tag. You can rename and recolour it, but its slug is fixed because the storefront uses it."
                : "Tags label products on the storefront. Attach one to a category, or give it an expiry."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name + slug */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-charcoal">Name</label>
              <Input
                value={fLabel}
                onChange={(e) => {
                  setFLabel(e.target.value);
                  if (!editTag) setFSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Flash Sale"
                maxLength={80}
              />
              {fSlug && (
                <p className="mt-1 text-[11px] text-charcoal-lighter">
                  Slug: <code>{fSlug}</code>
                  {editTag && " — can't be changed after creation"}
                </p>
              )}
            </div>

            {/* Colour */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-charcoal">Colour</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={fColor}
                  onChange={(e) => setFColor(e.target.value.toUpperCase())}
                  className="h-9 w-12 cursor-pointer rounded border border-border/40 bg-transparent p-0.5"
                  aria-label="Tag colour"
                />
                <Input
                  value={fColor}
                  onChange={(e) => setFColor(e.target.value.toUpperCase())}
                  className="w-28 font-mono text-xs"
                  maxLength={7}
                />
                <div className="flex flex-wrap gap-1">
                  {SWATCHES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFColor(s)}
                      aria-label={`Use ${s}`}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                        fColor === s ? "border-charcoal" : "border-transparent"
                      )}
                      style={{ backgroundColor: s }}
                    />
                  ))}
                </div>
              </div>

              {/* Text colour */}
              <div className="mt-3 flex items-center gap-3">
                <Switch checked={fAutoText} onCheckedChange={setFAutoText} id="auto-text" />
                <label htmlFor="auto-text" className="text-xs text-charcoal-light">
                  Pick text colour automatically
                </label>
                {!fAutoText && (
                  <input
                    type="color"
                    value={fTextColor}
                    onChange={(e) => setFTextColor(e.target.value.toUpperCase())}
                    className="h-8 w-10 cursor-pointer rounded border border-border/40 bg-transparent p-0.5"
                    aria-label="Text colour"
                  />
                )}
              </div>

              {/* Preview on both a light and a dark ground, because product tags
                  sit on photography that could be either. */}
              <div className="mt-3 flex items-center gap-3 rounded-luxury border border-border/30 p-3">
                <span className="text-[11px] text-charcoal-lighter">Preview</span>
                <div className="flex flex-1 items-center justify-around gap-2 rounded bg-white p-2">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: fColor, color: effectiveText }}>
                    {fLabel.trim() || "Tag"}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-around gap-2 rounded bg-charcoal p-2">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: fColor, color: effectiveText }}>
                    {fLabel.trim() || "Tag"}
                  </span>
                </div>
              </div>
              {lowContrast && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-warning">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  Contrast is {ratio.toFixed(1)}:1 — below the 4.5:1 that&apos;s comfortably readable. It will still save.
                </p>
              )}
            </div>

            {/* Attachment */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-charcoal">Attach to</label>
              <Select value={fAttachType} onValueChange={(v) => changeAttachType(v as TagAttachType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ATTACH_LABELS) as TagAttachType[]).map((k) => (
                    <SelectItem key={k} value={k}>{ATTACH_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {fAttachType === "product" && (
                <Input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search products by name or SKU…"
                  className="mt-2"
                />
              )}

              {fAttachType !== "none" && (
                <>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-luxury border border-border/30 p-2">
                    {attachOptions.length === 0 ? (
                      <p className="p-2 text-[11px] text-charcoal-lighter">
                        {fAttachType === "product" ? "Type at least 2 characters to search." : "Nothing to choose from yet."}
                      </p>
                    ) : (
                      attachOptions.map((o) => (
                        <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-xs hover:bg-pearl/40">
                          <input
                            type="checkbox"
                            checked={fAttachIds.includes(o.id)}
                            onChange={(e) => setFAttachIds((prev) =>
                              e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)
                            )}
                            className="accent-secondary"
                          />
                          <span className="truncate">{o.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {fAttachIds.length > 0 && (
                    <p className="mt-1 text-[11px] text-charcoal-lighter">{fAttachIds.length} selected</p>
                  )}
                  {(fAttachType === "offer" || fAttachType === "coupon") && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-charcoal-lighter">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      Shows the tag on that {fAttachType}. It doesn&apos;t change pricing or which products the {fAttachType} covers.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Validity — only meaningful for an unattached tag */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-charcoal">Validity</label>
              {fAttachType !== "none" ? (
                <p className="rounded-luxury border border-border/30 bg-pearl/20 p-2.5 text-[11px] text-charcoal-lighter">
                  An attached tag doesn&apos;t expire — it lasts as long as the {ATTACH_LABELS[fAttachType].toLowerCase()} it&apos;s attached to.
                </p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Select value={fValidityMode} onValueChange={(v) => { setFValidityMode(v as TagValidityMode); setFValidityValue(""); }}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(VALIDITY_LABELS) as TagValidityMode[]).map((k) => (
                          <SelectItem key={k} value={k}>{VALIDITY_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fValidityMode === "date" && (
                      <Input type="date" value={fValidityValue} onChange={(e) => setFValidityValue(e.target.value)} className="flex-1" />
                    )}
                    {(fValidityMode === "days" || fValidityMode === "months" || fValidityMode === "years") && (
                      <Input
                        type="number" min={1} max={3650}
                        value={fValidityValue}
                        onChange={(e) => setFValidityValue(e.target.value)}
                        placeholder={fValidityMode === "days" ? "30" : "1"}
                        className="w-28"
                      />
                    )}
                  </div>
                  {fValidityMode !== "none" && fValidityMode !== "date" && (
                    <p className="mt-1 text-[11px] text-charcoal-lighter">
                      Counted from the day the tag is added to each product — so it expires per product, not all at once.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Active */}
            {!editTag?.is_system && (
              <div className="flex items-center gap-3">
                <Switch checked={fActive} onCheckedChange={setFActive} id="tag-active" />
                <label htmlFor="tag-active" className="text-xs text-charcoal-light">
                  Show this tag on the storefront
                </label>
              </div>
            )}

            {(formError || invariantError) && (
              <div className="flex items-start gap-2 rounded-luxury border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{formError || invariantError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <AdminButton variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</AdminButton>
            <AdminButton onClick={save} disabled={!isFormValid || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {saving ? "Saving…" : editTag ? "Save Changes" : "Create Tag"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete confirmation ═══ */}
      <Dialog open={!!deleteDialog} onOpenChange={(o) => { if (!o) setDeleteDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleteDialog?.label}&rdquo;?</DialogTitle>
            <DialogDescription>
              This also removes the tag from every product using it. Products themselves are not affected.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={confirmDelete} disabled={saving}>
              {saving ? "Deleting…" : "Delete Tag"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
