"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, MoreHorizontal, Copy, Percent, BadgeDollarSign, Loader2, AlertTriangle, Check, Tag } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";
import type { Coupon } from "@/types/coupon";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");

  // Form
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<"percentage" | "fixed">("percentage");
  const [formValue, setFormValue] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formMaxDiscount, setFormMaxDiscount] = useState("");
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState("");
  const [formActive, setFormActive] = useState(true);

  const fetchCoupons = async () => {
    try {
      const res = await fetch("/api/coupons");
      const data = await res.json();
      setCoupons(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchCoupons(); }, []);

  const resetForm = () => {
    setFormCode(""); setFormDesc(""); setFormType("percentage"); setFormValue("");
    setFormMinOrder(""); setFormMaxDiscount(""); setFormValidFrom(""); setFormValidUntil("");
    setFormUsageLimit(""); setFormActive(true); setEditCoupon(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (coupon: Coupon) => {
    setEditCoupon(coupon);
    setFormCode(coupon.code);
    setFormDesc(coupon.description || "");
    setFormType(coupon.discount_type);
    setFormValue(String(coupon.discount_value));
    setFormMinOrder(coupon.min_order_amount ? String(coupon.min_order_amount) : "");
    setFormMaxDiscount(coupon.max_discount_amount ? String(coupon.max_discount_amount) : "");
    setFormValidFrom(coupon.valid_from ? coupon.valid_from.slice(0, 10) : "");
    setFormValidUntil(coupon.valid_until ? coupon.valid_until.slice(0, 10) : "");
    setFormUsageLimit(coupon.usage_limit ? String(coupon.usage_limit) : "");
    setFormActive(coupon.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formCode.trim() || !formValue) return;
    setSaving(true);
    try {
      const payload = {
        code: formCode.trim().toUpperCase(),
        description: formDesc.trim() || null,
        discount_type: formType,
        discount_value: Number(formValue),
        min_order_amount: formMinOrder ? Number(formMinOrder) : null,
        max_discount_amount: formMaxDiscount ? Number(formMaxDiscount) : null,
        valid_from: formValidFrom || null,
        valid_until: formValidUntil || null,
        usage_limit: formUsageLimit ? Number(formUsageLimit) : null,
        is_active: formActive,
      };
      if (editCoupon) {
        await fetch(`/api/coupons/${editCoupon.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setDialogOpen(false);
      resetForm();
      fetchCoupons();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch(`/api/coupons/${deleteDialog.id}`, { method: "DELETE" }).catch(() => {});
    setCoupons((prev) => prev.filter((c) => c.id !== deleteDialog.id));
    setDeleteDialog(null);
  };

  const handleToggleActive = async (coupon: Coupon) => {
    const newActive = !coupon.is_active;
    await fetch(`/api/coupons/${coupon.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: newActive }) }).catch(() => {});
    setCoupons((prev) => prev.map((c) => c.id === coupon.id ? { ...c, is_active: newActive } : c));
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1500);
  };

  const activeCount = coupons.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Coupons</h1>
          <p className="text-sm text-charcoal-lighter">{coupons.length} coupon{coupons.length !== 1 ? "s" : ""} · {activeCount} active</p>
        </div>
        <AdminButton onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Coupon</AdminButton>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-40 w-full" /></CardContent></Card>)}
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState icon={Tag} title="No coupons yet" description="Create your first discount coupon." actionLabel="Add Coupon" onAction={openCreate} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((coupon) => {
            const usagePercent = coupon.usage_limit ? (coupon.used_count / coupon.usage_limit) * 100 : 0;
            const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();

            return (
              <Card key={coupon.id} className={cn("relative overflow-hidden", (!coupon.is_active || isExpired) && "opacity-60")}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary to-primary" />
                <CardContent className="p-5 pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
                        {coupon.discount_type === "percentage" ? <Percent className="h-5 w-5 text-secondary" /> : <BadgeDollarSign className="h-5 w-5 text-secondary" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-charcoal text-sm">{coupon.code}</code>
                          <button onClick={() => handleCopy(coupon.code)} className="text-charcoal-lighter hover:text-secondary transition-colors">
                            {copied === coupon.code ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        {coupon.description && <p className="text-[10px] text-charcoal-lighter">{coupon.description}</p>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1 hover:bg-pearl rounded-md"><MoreHorizontal className="h-4 w-4 text-charcoal-lighter" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(coupon)}><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(coupon)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="text-2xl font-bold text-charcoal mb-3">
                    {coupon.discount_type === "percentage" ? `${coupon.discount_value}% OFF` : `${formatCurrency(coupon.discount_value)} OFF`}
                  </div>

                  <div className="space-y-1 text-xs text-charcoal-lighter">
                    {coupon.min_order_amount ? <p>Min. order: {formatCurrency(coupon.min_order_amount)}</p> : null}
                    {coupon.max_discount_amount ? <p>Max discount: {formatCurrency(coupon.max_discount_amount)}</p> : null}
                    {coupon.valid_from && coupon.valid_until && <p>Valid: {formatDateShort(coupon.valid_from)} — {formatDateShort(coupon.valid_until)}</p>}
                  </div>

                  {coupon.usage_limit ? (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-charcoal-lighter mb-1">
                        <span>{coupon.used_count} used</span>
                        <span>{coupon.usage_limit} limit</span>
                      </div>
                      <Progress value={usagePercent} />
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                    <Badge variant={isExpired ? "destructive" : coupon.is_active ? "success" : "warning"}>
                      {isExpired ? "Expired" : coupon.is_active ? "Active" : "Paused"}
                    </Badge>
                    <Switch checked={coupon.is_active} onCheckedChange={() => handleToggleActive(coupon)} />
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
            <DialogTitle>{editCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
            <DialogDescription>{editCoupon ? "Update coupon details" : "Add a new discount coupon"}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 py-2 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Coupon Code *" placeholder="e.g., SUMMER25" value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} />
              <Input label="Description" placeholder="25% off summer collection" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Discount Type</label>
                <Select value={formType} onValueChange={(v) => setFormType(v as "percentage" | "fixed")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (৳)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input label={formType === "percentage" ? "Discount %" : "Discount Amount (৳)"} placeholder={formType === "percentage" ? "25" : "500"} type="number" value={formValue} onChange={(e) => setFormValue(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Min. Order (৳)" placeholder="1500" type="number" value={formMinOrder} onChange={(e) => setFormMinOrder(e.target.value)} />
              <Input label="Max Discount (৳)" placeholder="500" type="number" value={formMaxDiscount} onChange={(e) => setFormMaxDiscount(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valid From" type="date" value={formValidFrom} onChange={(e) => setFormValidFrom(e.target.value)} />
              <Input label="Valid Until" type="date" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Usage Limit" placeholder="1000 (leave empty for unlimited)" type="number" value={formUsageLimit} onChange={(e) => setFormUsageLimit(e.target.value)} />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                  <span className="text-sm font-medium text-charcoal-light">{formActive ? "Active" : "Paused"}</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving || !formCode.trim() || !formValue}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editCoupon ? "Save Changes" : "Create Coupon"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Coupon</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteDialog && (
            <div className="p-3 rounded-xl bg-pearl/60">
              <code className="font-mono font-bold text-charcoal">{deleteDialog.code}</code>
              <p className="text-xs text-charcoal-lighter mt-1">{deleteDialog.discount_type === "percentage" ? `${deleteDialog.discount_value}% off` : `${formatCurrency(deleteDialog.discount_value)} off`} · {deleteDialog.used_count} times used</p>
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
