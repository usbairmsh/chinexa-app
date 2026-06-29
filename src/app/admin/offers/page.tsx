"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, MoreHorizontal, Zap, Clock, Gift, Loader2, AlertTriangle, Tag } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateShort, cn } from "@/lib/utils";
import type { Offer } from "@/types/offer";

const typeIcons: Record<string, typeof Zap> = {
  bogo: Gift, seasonal: Clock, bundle: Gift, flash: Zap, welcome: Gift, clearance: Zap,
};

const typeColors: Record<string, string> = {
  bogo: "bg-emerald-50 text-emerald-600",
  seasonal: "bg-amber-50 text-amber-600",
  bundle: "bg-violet-50 text-violet-600",
  flash: "bg-red-50 text-red-600",
  welcome: "bg-blue-50 text-blue-600",
  clearance: "bg-orange-50 text-orange-600",
};

const typeLabels: Record<string, string> = {
  bogo: "Buy One Get One", seasonal: "Seasonal Sale", bundle: "Bundle Deal",
  flash: "Flash Sale", welcome: "Welcome Offer", clearance: "Clearance",
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
  const [formType, setFormType] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDiscount, setFormDiscount] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formActive, setFormActive] = useState(true);

  const fetchOffers = async () => {
    try {
      const res = await fetch("/api/offers");
      const data = await res.json();
      setOffers(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchOffers(); }, []);

  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormType(""); setFormCategory("");
    setFormDiscount(""); setFormStartDate(""); setFormEndDate(""); setFormActive(true);
    setEditOffer(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (offer: Offer) => {
    setEditOffer(offer);
    setFormTitle(offer.title);
    setFormDesc(offer.description || "");
    setFormType(offer.type);
    setFormCategory(offer.category || "");
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
        type: formType,
        category: formCategory.trim() || null,
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
      setDialogOpen(false);
      resetForm();
      fetchOffers();
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
            const Icon = typeIcons[offer.type] || Gift;
            const isExpired = offer.end_date && new Date(offer.end_date) < new Date();

            return (
              <Card key={offer.id} className={cn("transition-opacity", (!offer.is_active || isExpired) && "opacity-60")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", typeColors[offer.type] || "bg-pearl text-charcoal")}>
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

                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs font-bold">{offer.discount}</Badge>
                    {offer.category && <span className="text-[10px] text-charcoal-lighter">{offer.category}</span>}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-charcoal-lighter mb-3">
                    {offer.type && <Badge variant="outline" className="text-[9px]">{offer.type}</Badge>}
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
            <div className="grid grid-cols-2 gap-3">
              <Input label="Offer Type" placeholder="e.g., Seasonal Sale, Flash Sale, BOGO" value={formType} onChange={(e) => setFormType(e.target.value)} />
              <Input label="Discount *" placeholder="30% OFF" value={formDiscount} onChange={(e) => setFormDiscount(e.target.value)} />
            </div>
            <Input label="Applicable Categories" placeholder="Skincare, Bags, All" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
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

      {/* Delete Confirmation */}
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
