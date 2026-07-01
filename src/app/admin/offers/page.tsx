"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, MoreHorizontal, Loader2, AlertTriangle, Tag, Search, X, Users, FolderTree, ShoppingCart, Globe, Check } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateShort, cn } from "@/lib/utils";
import type { Offer, OfferApplicability } from "@/types/offer";

const applicabilityConfig: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  store: { label: "Store-wide", icon: Globe, color: "bg-blue-50 text-blue-600" },
  categories: { label: "Categories", icon: FolderTree, color: "bg-emerald-50 text-emerald-600" },
  subcategories: { label: "Subcategories", icon: FolderTree, color: "bg-violet-50 text-violet-600" },
  customers: { label: "Customers", icon: Users, color: "bg-amber-50 text-amber-600" },
};

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOffer, setEditOffer] = useState<Offer | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Offer | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formApplicability, setFormApplicability] = useState<OfferApplicability>("store");
  const [formSelectedIds, setFormSelectedIds] = useState<{ id: string; name: string }[]>([]);
  const [formDiscount, setFormDiscount] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Search state for applicability selection
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; extra?: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Categories/subcategories cache
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; children?: { id: string; name: string }[] }[]>([]);

  const fetchOffers = async () => {
    try {
      const res = await fetch("/api/offers");
      const data = await res.json();
      setOffers(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchOffers();
    fetch("/api/categories").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAllCategories(data);
    }).catch(() => {});
  }, []);

  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormApplicability("store"); setFormSelectedIds([]);
    setFormDiscount(""); setFormStartDate(""); setFormEndDate(""); setFormActive(true);
    setEditOffer(null); setSearchQuery(""); setSearchResults([]);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (offer: Offer) => {
    setEditOffer(offer);
    setFormTitle(offer.title);
    setFormDesc(offer.description || "");
    setFormApplicability(offer.applicability || "store");
    setFormSelectedIds((offer.applicable_ids || []).map((id, i) => ({ id, name: offer.applicable_names?.[i] || id })));
    setFormDiscount(offer.discount);
    setFormStartDate(offer.start_date ? offer.start_date.slice(0, 10) : "");
    setFormEndDate(offer.end_date ? offer.end_date.slice(0, 10) : "");
    setFormActive(offer.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formDiscount.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        applicability: formApplicability,
        applicable_ids: formApplicability === "store" ? [] : formSelectedIds.map((s) => s.id),
        discount: formDiscount.trim(),
        start_date: formStartDate || null,
        end_date: formEndDate || null,
        is_active: formActive,
      };
      if (editOffer) {
        await fetch(`/api/offers/${editOffer.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setDialogOpen(false); resetForm(); fetchOffers();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch(`/api/offers/${deleteDialog.id}`, { method: "DELETE" }).catch(() => {});
    setOffers((prev) => prev.filter((o) => o.id !== deleteDialog.id));
    setDeleteDialog(null);
  };

  const handleToggleActive = async (offer: Offer) => {
    const newActive = !offer.is_active;
    await fetch(`/api/offers/${offer.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: newActive }) }).catch(() => {});
    setOffers((prev) => prev.map((o) => o.id === offer.id ? { ...o, is_active: newActive } : o));
  };

  // Search handler for customers by phone
  const handleCustomerSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 3) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page_size=10`);
      const data = await res.json();
      if (data?.data) setSearchResults(data.data.map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string, extra: c.phone as string })));
    } catch {} finally { setSearchLoading(false); }
  };

  // Get category/subcategory options based on applicability
  const getCategoryOptions = () => {
    if (formApplicability === "categories") {
      return allCategories.map((c) => ({ id: c.id, name: c.name }));
    }
    if (formApplicability === "subcategories") {
      return allCategories.flatMap((c) => (c.children || []).map((s) => ({ id: s.id, name: `${c.name} → ${s.name}` })));
    }
    return [];
  };

  const toggleSelected = (item: { id: string; name: string }) => {
    setFormSelectedIds((prev) =>
      prev.find((s) => s.id === item.id) ? prev.filter((s) => s.id !== item.id) : [...prev, item]
    );
  };

  const removeSelected = (id: string) => {
    setFormSelectedIds((prev) => prev.filter((s) => s.id !== id));
  };

  const activeCount = offers.filter((o) => o.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Offers & Promotions</h1>
          <p className="text-sm text-charcoal-lighter">{offers.length} offer{offers.length !== 1 ? "s" : ""} · {activeCount} active</p>
        </div>
        <AdminButton onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Create Offer</AdminButton>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-44 w-full" /></CardContent></Card>)}
        </div>
      ) : offers.length === 0 ? (
        <EmptyState icon={Tag} title="No offers yet" description="Create your first promotional offer." actionLabel="Create Offer" onAction={openCreate} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => {
            const config = applicabilityConfig[offer.applicability] || applicabilityConfig.store;
            const Icon = config.icon;
            const isExpired = offer.end_date && new Date(offer.end_date) < new Date();

            return (
              <Card key={offer.id} className={cn("transition-opacity", (!offer.is_active || isExpired) && "opacity-60")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1 hover:bg-pearl rounded-md"><MoreHorizontal className="h-4 w-4 text-charcoal-lighter" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(offer)}><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(offer)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <h3 className="font-medium text-charcoal mb-1">{offer.title}</h3>
                  {offer.description && <p className="text-xs text-charcoal-lighter mb-3 line-clamp-2">{offer.description}</p>}

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Badge variant="secondary" className="text-xs font-bold !text-white">{offer.discount}</Badge>
                    <Badge variant="outline" className="text-[9px]">{config.label}</Badge>
                  </div>

                  {offer.applicable_ids && offer.applicable_ids.length > 0 && (
                    <p className="text-[10px] text-charcoal-lighter mb-2">{offer.applicable_ids.length} {offer.applicability === "customers" ? "customer" : "categor"}{offer.applicable_ids.length > 1 ? (offer.applicability === "customers" ? "s" : "ies") : (offer.applicability === "customers" ? "" : "y")}</p>
                  )}

                  <div className="flex items-center gap-2 text-[10px] text-charcoal-lighter mb-3">
                    {offer.start_date && offer.end_date && (
                      <span>{formatDateShort(offer.start_date)} — {formatDateShort(offer.end_date)}</span>
                    )}
                    <span>{offer.usage_count} used</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/30">
                    <Badge variant={isExpired ? "destructive" : offer.is_active ? "success" : "warning"}>
                      {isExpired ? "Expired" : offer.is_active ? "Active" : "Paused"}
                    </Badge>
                    <Switch checked={offer.is_active} onCheckedChange={() => handleToggleActive(offer)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editOffer ? "Edit Offer" : "Create Offer"}</DialogTitle>
            <DialogDescription>{editOffer ? "Update offer details" : "Set up a new promotional campaign"}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 py-2 pr-1">
            <Input label="Offer Title *" placeholder="Summer Sale — 30% Off" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            <Textarea label="Description" placeholder="Describe the offer details..." value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="min-h-[60px]" />
            <Input label="Discount *" placeholder="e.g., 30% OFF, Buy 1 Get 1, ৳500 OFF" value={formDiscount} onChange={(e) => setFormDiscount(e.target.value)} />

            {/* Applicability */}
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Offer Applicability</label>
              <Select value={formApplicability} onValueChange={(v) => { setFormApplicability(v as OfferApplicability); setFormSelectedIds([]); setSearchQuery(""); setSearchResults([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="store"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Store-wide (All products)</span></SelectItem>
                  <SelectItem value="categories"><span className="flex items-center gap-2"><FolderTree className="h-3.5 w-3.5" /> Specific Categories</span></SelectItem>
                  <SelectItem value="subcategories"><span className="flex items-center gap-2"><FolderTree className="h-3.5 w-3.5" /> Specific Subcategories</span></SelectItem>
                  <SelectItem value="customers"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Specific Customers</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selected items */}
            {formApplicability !== "store" && (
              <div className="space-y-2">
                {/* Selected tags */}
                {formSelectedIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formSelectedIds.map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-medium">
                        {item.name}
                        <button type="button" onClick={() => removeSelected(item.id)} className="hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Customer search */}
                {formApplicability === "customers" && (
                  <div>
                    <div className="flex items-center gap-2 px-3 rounded-xl border border-border bg-pearl/30">
                      <Search className="h-3.5 w-3.5 text-charcoal-lighter shrink-0" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleCustomerSearch(e.target.value)}
                        placeholder="Search by phone number (e.g., 01712...)"
                        className="w-full py-2.5 text-sm bg-transparent outline-none text-charcoal placeholder:text-charcoal-lighter/50"
                      />
                      {searchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-charcoal-lighter shrink-0" />}
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-1 max-h-36 overflow-y-auto border border-border/30 rounded-xl bg-white">
                        {searchResults.map((r) => {
                          const isSelected = formSelectedIds.some((s) => s.id === r.id);
                          return (
                            <button key={r.id} type="button" onClick={() => toggleSelected({ id: r.id, name: r.name })}
                              className={cn("w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-pearl transition-colors", isSelected && "bg-secondary/5")}>
                              <div>
                                <p className="text-xs font-medium text-charcoal">{r.name}</p>
                                <p className="text-[10px] text-charcoal-lighter">{r.extra}</p>
                              </div>
                              {isSelected && <Check className="h-4 w-4 text-secondary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Category/Subcategory selection */}
                {(formApplicability === "categories" || formApplicability === "subcategories") && (
                  <div className="max-h-44 overflow-y-auto border border-border/30 rounded-xl bg-white">
                    {getCategoryOptions().length === 0 ? (
                      <p className="px-3 py-4 text-xs text-charcoal-lighter text-center">No {formApplicability} found</p>
                    ) : getCategoryOptions().map((opt) => {
                      const isSelected = formSelectedIds.some((s) => s.id === opt.id);
                      return (
                        <button key={opt.id} type="button" onClick={() => toggleSelected(opt)}
                          className={cn("w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-pearl transition-colors border-b border-border/10 last:border-0", isSelected && "bg-secondary/5")}>
                          <span className="text-xs text-charcoal">{opt.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-secondary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Date" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
              <Input label="End Date" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <span className="text-sm font-medium text-charcoal-light">{formActive ? "Active" : "Paused"}</span>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving || !formTitle.trim() || !formDiscount.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editOffer ? "Save Changes" : "Create Offer"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Offer</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteDialog && (
            <div className="p-3 rounded-xl bg-pearl/60">
              <p className="text-sm font-medium text-charcoal">{deleteDialog.title}</p>
              <p className="text-xs text-charcoal-lighter mt-1">{deleteDialog.discount} · {deleteDialog.usage_count} times used</p>
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
