"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, MoreHorizontal, Copy, Percent, BadgeDollarSign, Loader2, AlertTriangle, Check, Tag, Users, Crown, Globe, FolderTree, ShoppingCart, Search, X, Award } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";
import type { Coupon, CouponApplicability } from "@/types/coupon";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");

  // Assign state
  const [assignDialog, setAssignDialog] = useState<Coupon | null>(null);
  const [assignMode, setAssignMode] = useState<"tier" | "customer">("tier");
  const [assignTier, setAssignTier] = useState("");
  const [assignCustomerSearch, setAssignCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [tiers, setTiers] = useState<{ id: string; name: string; color: string }[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);

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
  const [formPerCustomerLimit, setFormPerCustomerLimit] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Applicability (same model as offers)
  const [formApplicability, setFormApplicability] = useState<CouponApplicability>("store");
  const [formSelectedIds, setFormSelectedIds] = useState<{ id: string; name: string }[]>([]);
  const [applSearchQuery, setApplSearchQuery] = useState("");
  const [applSearchResults, setApplSearchResults] = useState<{ id: string; name: string; extra?: string }[]>([]);
  const [applSearchLoading, setApplSearchLoading] = useState(false);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; children?: { id: string; name: string }[] }[]>([]);
  const [allTiers, setAllTiers] = useState<{ id: string; name: string }[]>([]);
  const [allBrands, setAllBrands] = useState<{ id: string; name: string }[]>([]);

  const fetchCoupons = async () => {
    try {
      const res = await fetch("/api/coupons");
      const data = await res.json();
      setCoupons(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchCoupons();
    fetch("/api/categories").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAllCategories(data);
    }).catch(() => {});
    fetch("/api/membership/tiers").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAllTiers(data.map((t: Record<string, unknown>) => ({ id: t.id as string, name: t.name as string })));
    }).catch(() => {});
    fetch("/api/brands").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAllBrands(data.map((b: Record<string, unknown>) => ({ id: b.id as string, name: b.name as string })));
    }).catch(() => {});
  }, []);

  // Applicability helpers (mirror offers page)
  const handleApplSearch = async (q: string) => {
    setApplSearchQuery(q);
    if (q.length < 2) { setApplSearchResults([]); return; }
    setApplSearchLoading(true);
    try {
      if (formApplicability === "customers") {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page_size=10`);
        const data = await res.json();
        if (data?.data) setApplSearchResults(data.data.map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string, extra: c.phone as string })));
      } else if (formApplicability === "products") {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&all=1&page_size=10`);
        const data = await res.json();
        if (data?.data) setApplSearchResults(data.data.map((p: Record<string, unknown>) => ({ id: p.id as string, name: p.name as string, extra: p.sku as string })));
      }
    } catch {} finally { setApplSearchLoading(false); }
  };

  const getApplOptions = () => {
    if (formApplicability === "categories") return allCategories.map((c) => ({ id: c.id, name: c.name }));
    if (formApplicability === "subcategories") return allCategories.flatMap((c) => (c.children || []).map((s) => ({ id: s.id, name: `${c.name} → ${s.name}` })));
    if (formApplicability === "tiers") return allTiers;
    if (formApplicability === "brands") return allBrands;
    return [];
  };

  const toggleApplSelected = (item: { id: string; name: string }) => {
    setFormSelectedIds((prev) => prev.find((s) => s.id === item.id) ? prev.filter((s) => s.id !== item.id) : [...prev, item]);
  };

  const resetForm = () => {
    setFormCode(""); setFormDesc(""); setFormType("percentage"); setFormValue("");
    setFormMinOrder(""); setFormMaxDiscount(""); setFormValidFrom(""); setFormValidUntil("");
    setFormUsageLimit(""); setFormPerCustomerLimit(""); setFormActive(true); setEditCoupon(null);
    setFormApplicability("store"); setFormSelectedIds([]); setApplSearchQuery(""); setApplSearchResults([]);
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
    setFormPerCustomerLimit(coupon.per_customer_limit ? String(coupon.per_customer_limit) : "");
    setFormActive(coupon.is_active);
    setFormApplicability(coupon.applicability || "store");
    setFormSelectedIds((coupon.applicable_ids || []).map((id, i) => ({ id, name: coupon.applicable_names?.[i] || id })));
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
        per_customer_limit: formPerCustomerLimit ? Number(formPerCustomerLimit) : null,
        applicability: formApplicability,
        applicable_ids: formApplicability === "store" ? [] : formSelectedIds.map((s) => s.id),
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

  const openAssign = async (coupon: Coupon) => {
    setAssignDialog(coupon);
    setAssignMode("tier");
    setAssignTier("");
    setSelectedCustomerIds([]);
    setAssignCustomerSearch("");
    setSearchResults([]);
    try {
      const res = await fetch("/api/membership/tiers");
      const data = await res.json();
      if (Array.isArray(data)) setTiers(data);
    } catch {}
  };

  const handleSearchCustomers = async (q: string) => {
    setAssignCustomerSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page_size=10`);
      const data = await res.json();
      if (data?.data) setSearchResults(data.data);
    } catch {}
  };

  const toggleCustomerSelect = (id: string) => {
    setSelectedCustomerIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (!assignDialog) return;
    setAssignSaving(true);
    try {
      const payload: { customer_ids?: string[]; tier_name?: string } = {};
      if (assignMode === "tier" && assignTier) payload.tier_name = assignTier;
      if (assignMode === "customer" && selectedCustomerIds.length > 0) payload.customer_ids = selectedCustomerIds;
      if (!payload.tier_name && !payload.customer_ids) return;
      await fetch(`/api/coupons/${assignDialog.id}/assign`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setAssignDialog(null);
    } catch {} finally { setAssignSaving(false); }
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
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light shrink-0">
                        {coupon.discount_type === "percentage" ? <Percent className="h-5 w-5 text-secondary" /> : <BadgeDollarSign className="h-5 w-5 text-secondary" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="font-mono font-bold text-charcoal text-sm truncate">{coupon.code}</code>
                          <button onClick={() => handleCopy(coupon.code)} className="text-charcoal-lighter hover:text-secondary transition-colors shrink-0">
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
                        <DropdownMenuItem onClick={() => openAssign(coupon)}><Users className="h-3.5 w-3.5 mr-2" /> Assign</DropdownMenuItem>
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
                    {coupon.per_customer_limit ? <p>Limit: {coupon.per_customer_limit} per customer</p> : null}
                    {coupon.applicability && coupon.applicability !== "store" ? <p className="capitalize">Applies to: {coupon.applicability}{coupon.applicable_ids?.length ? ` (${coupon.applicable_ids.length})` : ""}</p> : null}
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
            {/* Applicability — who/what the coupon can be redeemed on */}
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5"><FieldLabel label="Coupon Applicability" hint="Customers must be signed in to redeem this coupon when applicability is set to Specific Customers or Membership Tiers." /></label>
              <Select value={formApplicability} onValueChange={(v) => { setFormApplicability(v as CouponApplicability); setFormSelectedIds([]); setApplSearchQuery(""); setApplSearchResults([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="store"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Store-wide (All products)</span></SelectItem>
                  <SelectItem value="categories"><span className="flex items-center gap-2"><FolderTree className="h-3.5 w-3.5" /> Specific Categories</span></SelectItem>
                  <SelectItem value="subcategories"><span className="flex items-center gap-2"><FolderTree className="h-3.5 w-3.5" /> Specific Subcategories</span></SelectItem>
                  <SelectItem value="products"><span className="flex items-center gap-2"><ShoppingCart className="h-3.5 w-3.5" /> Specific Products</span></SelectItem>
                  <SelectItem value="brands"><span className="flex items-center gap-2"><Award className="h-3.5 w-3.5" /> Specific Brands</span></SelectItem>
                  <SelectItem value="customers"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Specific Customers</span></SelectItem>
                  <SelectItem value="tiers"><span className="flex items-center gap-2"><Crown className="h-3.5 w-3.5" /> Membership Tiers</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formApplicability !== "store" && (
              <div className="space-y-2">
                {formSelectedIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formSelectedIds.map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-medium">
                        {item.name}
                        <button type="button" onClick={() => setFormSelectedIds((prev) => prev.filter((s) => s.id !== item.id))} className="hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {(formApplicability === "customers" || formApplicability === "products") && (
                  <div>
                    <div className="flex items-center gap-2 px-3 rounded-xl border border-border bg-pearl/30">
                      <Search className="h-3.5 w-3.5 text-charcoal-lighter shrink-0" />
                      <input
                        type="text"
                        value={applSearchQuery}
                        onChange={(e) => handleApplSearch(e.target.value)}
                        placeholder={formApplicability === "customers" ? "Search by phone number..." : "Search by product name or SKU..."}
                        className="w-full py-2.5 text-sm bg-transparent outline-none text-charcoal placeholder:text-charcoal-lighter/50"
                      />
                      {applSearchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-charcoal-lighter shrink-0" />}
                    </div>
                    {applSearchResults.length > 0 && (
                      <div className="mt-1 max-h-36 overflow-y-auto border border-border/30 rounded-xl bg-white">
                        {applSearchResults.map((r) => {
                          const isSelected = formSelectedIds.some((s) => s.id === r.id);
                          return (
                            <button key={r.id} type="button" onClick={() => toggleApplSelected({ id: r.id, name: r.name })}
                              className={cn("w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-pearl transition-colors", isSelected && "bg-secondary/5")}>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-charcoal truncate">{r.name}</p>
                                <p className="text-[10px] text-charcoal-lighter truncate">{r.extra}</p>
                              </div>
                              {isSelected && <Check className="h-4 w-4 text-secondary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {(formApplicability === "categories" || formApplicability === "subcategories" || formApplicability === "tiers" || formApplicability === "brands") && (
                  <div className="max-h-44 overflow-y-auto border border-border/30 rounded-xl bg-white">
                    {getApplOptions().length === 0 ? (
                      <p className="px-3 py-4 text-xs text-charcoal-lighter text-center">No {formApplicability} found</p>
                    ) : getApplOptions().map((opt) => {
                      const isSelected = formSelectedIds.some((s) => s.id === opt.id);
                      return (
                        <button key={opt.id} type="button" onClick={() => toggleApplSelected(opt)}
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

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Coupon Code *" placeholder="e.g., SUMMER25" value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} />
              <Input label="Description" placeholder="25% off summer collection" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Min. Order (৳)" placeholder="1500" type="number" value={formMinOrder} onChange={(e) => setFormMinOrder(e.target.value)} />
              <Input label="Max Discount (৳)" placeholder="500" type="number" value={formMaxDiscount} onChange={(e) => setFormMaxDiscount(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Valid From" type="date" value={formValidFrom} onChange={(e) => setFormValidFrom(e.target.value)} />
              <Input label="Valid Until" type="date" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Total Usage Limit" placeholder="1000 (empty = unlimited)" type="number" value={formUsageLimit} onChange={(e) => setFormUsageLimit(e.target.value)} />
              <Input label="Limit Per Customer" placeholder="1 (empty = unlimited)" type="number" value={formPerCustomerLimit} onChange={(e) => setFormPerCustomerLimit(e.target.value)} />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <span className="text-sm font-medium text-charcoal-light">{formActive ? "Active" : "Paused"}</span>
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

      {/* Assign Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={(open) => { if (!open) setAssignDialog(null); }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Assign Coupon</DialogTitle>
            <DialogDescription>
              Assign <code className="font-mono font-bold">{assignDialog?.code}</code> to a tier or specific customers
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button type="button" onClick={() => setAssignMode("tier")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-all", assignMode === "tier" ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter hover:bg-pearl")}>
                <Crown className="h-3.5 w-3.5" /> By Tier
              </button>
              <button type="button" onClick={() => setAssignMode("customer")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-all", assignMode === "customer" ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter hover:bg-pearl")}>
                <Users className="h-3.5 w-3.5" /> By Customer
              </button>
            </div>

            {assignMode === "tier" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal-lighter">Select Tier</label>
                <div className="space-y-2">
                  {tiers.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setAssignTier(tier.name)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                        assignTier === tier.name ? "border-secondary bg-secondary/5" : "border-border/30 hover:bg-pearl/50"
                      )}
                    >
                      <Badge className={cn("text-[10px]", tier.color)}>{tier.name}</Badge>
                      <span className="text-xs text-charcoal-lighter">All {tier.name} members</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  label="Search Customers"
                  placeholder="Type name or phone..."
                  value={assignCustomerSearch}
                  onChange={(e) => handleSearchCustomers(e.target.value)}
                />
                {selectedCustomerIds.length > 0 && (
                  <p className="text-[10px] text-secondary font-medium">{selectedCustomerIds.length} customer{selectedCustomerIds.length > 1 ? "s" : ""} selected</p>
                )}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => toggleCustomerSelect(cust.id)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-all text-left",
                        selectedCustomerIds.includes(cust.id) ? "border-secondary bg-secondary/5" : "border-border/20 hover:bg-pearl/50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-charcoal truncate">{cust.name}</p>
                        <p className="text-[10px] text-charcoal-lighter truncate">{cust.phone}</p>
                      </div>
                      {selectedCustomerIds.includes(cust.id) && <Check className="h-4 w-4 text-secondary shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => setAssignDialog(null)}>Cancel</AdminButton>
            <AdminButton
              onClick={handleAssign}
              disabled={assignSaving || (assignMode === "tier" ? !assignTier : selectedCustomerIds.length === 0)}
            >
              {assignSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Assign Coupon
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
