"use client";

import { useState } from "react";
import { Plus, Trash2, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { formatCurrency } from "@/lib/utils";

interface ProductOption { id: string; name: string; price: number; variants: { id: string; name: string; value: string; price_adjustment: number }[]; }
interface LineItem {
  key: string; product: ProductOption | null; variant_id: string | null;
  quantity: string; unit_price: string;
}

interface RecordSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}

function newLineItem(): LineItem {
  return { key: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, product: null, variant_id: null, quantity: "1", unit_price: "" };
}

export function RecordSaleDialog({ open, onOpenChange, onRecorded }: RecordSaleDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<LineItem[]>([newLineItem()]);
  const [productSearch, setProductSearch] = useState<Record<string, string>>({});
  const [productOptions, setProductOptions] = useState<Record<string, ProductOption[]>>({});
  const [shippingCost, setShippingCost] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [notes, setNotes] = useState("Facebook order");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setCustomerName(""); setCustomerPhone(""); setItems([newLineItem()]);
    setProductSearch({}); setProductOptions({});
    setShippingCost("0"); setDiscount("0"); setPaymentMethod("COD"); setPaymentStatus("pending");
    setNotes("Facebook order"); setError("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const searchProducts = (key: string, term: string) => {
    setProductSearch((s) => ({ ...s, [key]: term }));
    if (term.trim().length < 2) {
      setProductOptions((s) => ({ ...s, [key]: [] }));
      return;
    }
    fetch(`/api/products?search=${encodeURIComponent(term)}&all=1&page_size=8`)
      .then((r) => r.json())
      .then((json) => {
        const opts: ProductOption[] = (json.data || []).map((p: { id: string; name: string; price: number; variants?: { id: string; name: string; value: string; price_adjustment: number }[] }) => ({
          id: p.id, name: p.name, price: p.price, variants: p.variants || [],
        }));
        setProductOptions((s) => ({ ...s, [key]: opts }));
      })
      .catch(() => setProductOptions((s) => ({ ...s, [key]: [] })));
  };

  const selectProduct = (key: string, product: ProductOption) => {
    setItems((list) => list.map((it) => it.key === key ? {
      ...it, product, variant_id: null, unit_price: String(product.price),
    } : it));
    setProductOptions((s) => ({ ...s, [key]: [] }));
    setProductSearch((s) => ({ ...s, [key]: "" }));
  };

  const selectVariant = (key: string, product: ProductOption, variantId: string) => {
    const variant = product.variants.find((v) => v.id === variantId);
    setItems((list) => list.map((it) => it.key === key ? {
      ...it, variant_id: variantId || null,
      unit_price: String(product.price + (variant?.price_adjustment || 0)),
    } : it));
  };

  const updateItem = (key: string, field: "quantity" | "unit_price", value: string) => {
    setItems((list) => list.map((it) => it.key === key ? { ...it, [field]: value } : it));
  };

  const removeItem = (key: string) => setItems((list) => list.length > 1 ? list.filter((it) => it.key !== key) : list);
  const addItem = () => setItems((list) => [...list, newLineItem()]);

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(shippingCost) || 0));

  const productOptionsByKey = (key: string): ProductOption[] => productOptions[key] || [];

  const handleSave = async () => {
    if (!customerName.trim() || !customerPhone.trim()) { setError("Customer name and phone are required"); return; }
    const validItems = items.filter((it) => it.product && Number(it.quantity) > 0 && Number(it.unit_price) >= 0);
    if (validItems.length === 0) { setError("Add at least one valid product line"); return; }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          source: "manual",
          subtotal,
          shipping_cost: Number(shippingCost) || 0,
          discount: Number(discount) || 0,
          tax: 0,
          total,
          payment_method: paymentMethod,
          notes: notes || null,
          items: validItems.map((it) => {
            const variant = it.product!.variants.find((v) => v.id === it.variant_id);
            return {
              product_id: it.product!.id,
              variant_id: it.variant_id || null,
              product_name: it.product!.name,
              variant: variant ? `${variant.name}: ${variant.value}` : null,
              quantity: Number(it.quantity),
              unit_price: Number(it.unit_price),
              total_price: Number(it.quantity) * Number(it.unit_price),
            };
          }),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.error || (json?.out_of_stock ? json.out_of_stock.join(", ") : "Failed to record sale")); return; }
      if (paymentStatus === "paid") {
        await fetch(`/api/orders/${json.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_status: "paid" }) }).catch(() => {});
      }
      handleClose(false);
      onRecorded();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record Sale (Facebook / Manual Order)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" required />
            <Input label="Customer Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="01XXXXXXXXX" required />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-charcoal-light">Products</label>
            {items.map((it) => (
              <div key={it.key} className="rounded-xl border border-border/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 relative">
                    {it.product ? (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/30 bg-pearl/30">
                        <span className="text-sm text-charcoal truncate">{it.product.name}</span>
                        <button onClick={() => setItems((list) => list.map((li) => li.key === it.key ? { ...li, product: null, variant_id: null } : li))} className="text-charcoal-lighter hover:text-destructive shrink-0 ml-2">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="Search product..."
                          value={productSearch[it.key] || ""}
                          onChange={(e) => searchProducts(it.key, e.target.value)}
                          icon={<Search className="h-4 w-4" />}
                        />
                        {productOptionsByKey(it.key).length > 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-white shadow-lg max-h-48 overflow-y-auto">
                            {productOptionsByKey(it.key).map((p) => (
                              <button key={p.id} onClick={() => selectProduct(it.key, p)} className="block w-full text-left px-3 py-2 text-sm hover:bg-pearl/50">
                                {p.name} — {formatCurrency(p.price)}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(it.key)} className="p-1.5 rounded-full hover:bg-destructive/10 text-charcoal-lighter hover:text-destructive shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {it.product && it.product.variants.length > 0 && (
                  <Select value={it.variant_id || ""} onValueChange={(v) => selectVariant(it.key, it.product!, v)}>
                    <SelectTrigger><SelectValue placeholder="Select variant (optional)" /></SelectTrigger>
                    <SelectContent>
                      {it.product.variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}: {v.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Input label="Quantity" type="number" value={it.quantity} onChange={(e) => updateItem(it.key, "quantity", e.target.value)} required />
                  <Input label="Unit Price (৳)" type="number" value={it.unit_price} onChange={(e) => updateItem(it.key, "unit_price", e.target.value)} />
                </div>
                <p className="text-xs text-charcoal-lighter text-right">Line total: {formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}</p>
              </div>
            ))}
            <AdminButton variant="outline" onClick={addItem} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </AdminButton>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Shipping Cost (৳)" type="number" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} />
            <Input label="Discount (৳)" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COD">Cash on Delivery</SelectItem>
                  <SelectItem value="BKASH">bKash</SelectItem>
                  <SelectItem value="NAGAD">Nagad</SelectItem>
                  <SelectItem value="ROCKET">Rocket</SelectItem>
                  <SelectItem value="BANK">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Payment Status</label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" />

          <div className="rounded-lg bg-secondary/5 border border-secondary/20 px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-charcoal-light">Order Total</span>
            <span className="text-lg font-bold text-secondary">{formatCurrency(total)}</span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <AdminButton variant="outline" onClick={() => handleClose(false)}>Cancel</AdminButton>
          <AdminButton onClick={handleSave} disabled={saving}>{saving ? "Recording..." : "Record Sale"}</AdminButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
