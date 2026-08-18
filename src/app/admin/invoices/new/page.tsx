"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Plus, Trash2, Search, Loader2, Save, Printer, X, Upload } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdmin } from "@/contexts/admin-context";
import { formatCurrency } from "@/lib/utils";

// Live totals mirror the server's computeInvoice() exactly. The server always
// recomputes on save and its result wins — this is preview only.
type DiscountType = "amount" | "percent";

interface Variant { id: string; name: string; value: string; price_adjustment: number }
interface ProductOption { id: string; name: string; sku?: string; price: number; stock_quantity?: number; variants: Variant[] }

interface Line {
  key: string;
  product: ProductOption | null;
  variant_id: string | null;
  variant_name: string | null;
  product_name: string;
  quantity: string;
  unit_price: string;
  discount_type: DiscountType;
  discount_value: string;
}

const newLine = (): Line => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product: null, variant_id: null, variant_name: null, product_name: "",
  quantity: "1", unit_price: "", discount_type: "amount", discount_value: "",
});

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function resolveDiscount(base: number, type: DiscountType, value: number): number {
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  const raw = type === "percent" ? (base * v) / 100 : v;
  return money(Math.min(Math.max(raw, 0), base));
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { can, name: adminName } = useAdmin();
  const canAdd = can("accounting", "add");

  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [search, setSearch] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, ProductOption[]>>({});

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<{ id: string; name: string; phone: string; email?: string }[]>([]);

  const [discountType, setDiscountType] = useState<DiscountType>("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("");
  const [notes, setNotes] = useState("");

  const [affectsInventory, setAffectsInventory] = useState(false);
  const [generateOrderNo, setGenerateOrderNo] = useState(false);

  const [seal, setSeal] = useState("");
  const [signature, setSignature] = useState("");
  const [uploading, setUploading] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The seal and signature are uploaded once and reused. They're remembered in
  // store settings so the next invoice starts pre-stamped with no re-upload.
  useEffect(() => {
    fetch("/api/settings?key=invoice_stamp")
      .then((r) => r.json())
      .then((d) => {
        if (d?.value?.seal_url) setSeal(d.value.seal_url);
        if (d?.value?.signature_url) setSignature(d.value.signature_url);
      })
      .catch(() => {});
  }, []);

  const rememberStamp = useCallback((next: { seal_url?: string; signature_url?: string }) => {
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "invoice_stamp", value: { seal_url: seal, signature_url: signature, ...next } }),
    }).catch(() => {});
  }, [seal, signature]);

  const uploadImage = async (file: File, kind: "seal" | "signature") => {
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.url) { setError(json.error || "Upload failed"); return; }
      if (kind === "seal") { setSeal(json.url); rememberStamp({ seal_url: json.url }); }
      else { setSignature(json.url); rememberStamp({ signature_url: json.url }); }
    } catch {
      setError("Upload failed");
    } finally { setUploading(""); }
  };

  // ── Product search ──
  // `search` is the ONLY source of truth for what's typed in a line's box.
  // (An earlier version mirrored it into product_name as well, which fought the
  // input's value binding and made selection appear to do nothing.)
  // Search matches product name AND SKU — the API covers both.
  const searchProducts = (key: string, term: string) => {
    setSearch((s) => ({ ...s, [key]: term }));
    // A custom (non-catalogue) line is just typed text, so keep product_name in
    // step for the case where nothing is picked from the dropdown.
    setLines((list) => list.map((l) => (l.key === key ? { ...l, product_name: term } : l)));
    if (term.trim().length < 2) { setOptions((s) => ({ ...s, [key]: [] })); return; }
    fetch(`/api/products?search=${encodeURIComponent(term)}&all=1&page_size=8`)
      .then((r) => r.json())
      .then((json) => {
        const opts: ProductOption[] = (json.data || []).map((p: { id: string; name: string; sku?: string; price: number; stock_quantity?: number; variants?: Variant[] }) => ({
          id: p.id, name: p.name, sku: p.sku || "", price: Number(p.price) || 0,
          stock_quantity: Number(p.stock_quantity) || 0, variants: p.variants || [],
        }));
        setOptions((s) => ({ ...s, [key]: opts }));
      })
      .catch(() => setOptions((s) => ({ ...s, [key]: [] })));
  };

  const pickProduct = (key: string, p: ProductOption) => {
    // Quantity defaults to 1 and the price defaults to the system price — both
    // stay editable from here.
    setLines((list) => list.map((l) => l.key === key
      ? { ...l, product: p, product_name: p.name, variant_id: null, variant_name: null, unit_price: String(p.price), quantity: l.quantity || "1" }
      : l));
    setOptions((s) => ({ ...s, [key]: [] }));
    setSearch((s) => ({ ...s, [key]: p.name }));
  };

  const pickVariant = (key: string, variantId: string) => {
    setLines((list) => list.map((l) => {
      if (l.key !== key || !l.product) return l;
      const v = l.product.variants.find((x) => x.id === variantId);
      if (!v) return { ...l, variant_id: null, variant_name: null, unit_price: String(l.product.price) };
      return {
        ...l,
        variant_id: v.id,
        variant_name: `${v.name}: ${v.value}`,
        unit_price: String(money(l.product.price + (Number(v.price_adjustment) || 0))),
      };
    }));
  };

  const setLine = (key: string, patch: Partial<Line>) =>
    setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // ── Live totals ──
  const totals = useMemo(() => {
    const computed = lines.map((l) => {
      const qty = Math.max(1, Math.floor(Number(l.quantity) || 1));
      const price = Math.max(0, money(Number(l.unit_price) || 0));
      const gross = money(qty * price);
      const disc = resolveDiscount(gross, l.discount_type, Number(l.discount_value) || 0);
      return { gross, disc, total: money(gross - disc) };
    });
    const subtotal = money(computed.reduce((s, c) => s + c.total, 0));
    const lineDiscountTotal = money(computed.reduce((s, c) => s + c.disc, 0));
    const orderDiscount = resolveDiscount(subtotal, discountType, Number(discountValue) || 0);
    const delivery = Math.max(0, money(Number(deliveryCharge) || 0));
    return {
      perLine: computed,
      subtotal,
      lineDiscountTotal,
      orderDiscount,
      delivery,
      total: money(Math.max(0, subtotal - orderDiscount) + delivery),
    };
  }, [lines, discountType, discountValue, deliveryCharge]);

  const save = async (thenPrint: boolean) => {
    setError("");
    if (!customerName.trim()) { setError("Customer name is required"); return; }
    const valid = lines.filter((l) => l.product_name.trim() && Number(l.quantity) >= 1);
    if (valid.length === 0) { setError("Add at least one product"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/manual-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim(),
          customer_address: customerAddress.trim(),
          items: valid.map((l) => ({
            product_id: l.product?.id || null,
            variant_id: l.variant_id,
            product_name: l.product_name.trim(),
            variant_name: l.variant_name,
            quantity: Number(l.quantity) || 1,
            unit_price: Number(l.unit_price) || 0,
            discount_type: l.discount_type,
            discount_value: Number(l.discount_value) || 0,
          })),
          discount_type: discountType,
          discount_value: Number(discountValue) || 0,
          delivery_charge: Number(deliveryCharge) || 0,
          affects_inventory: affectsInventory,
          generate_order_number: generateOrderNo,
          notes: notes.trim(),
          seal_url: seal,
          signature_url: signature,
          created_by_name: adminName || "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Could not create the invoice"); return; }
      if (thenPrint) window.open(`/invoice?id=${encodeURIComponent(json.id)}&type=manual`, "_blank");
      router.push(`/admin/invoices/${json.id}`);
    } catch {
      setError("Network error — the invoice was not created");
    } finally { setSaving(false); }
  };

  if (!canAdd) {
    return <div className="p-6 text-sm text-charcoal-lighter">You do not have permission to create invoices.</div>;
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <AdminButton variant="ghost" size="sm" onClick={() => router.push("/admin/invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </AdminButton>
        <div>
          <h1 className="font-heading text-2xl font-bold text-charcoal">New Invoice</h1>
          <p className="text-xs text-charcoal-lighter">Saved as a draft — you can edit it until you publish.</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Customer */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-charcoal">Customer</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-lighter" />
                <Input
                  className="pl-9 h-10"
                  placeholder="Search an existing customer (optional)"
                  value={customerSearch}
                  onChange={(e) => {
                    const t = e.target.value;
                    setCustomerSearch(t);
                    if (t.trim().length < 2) { setCustomerOptions([]); return; }
                    fetch(`/api/customers?search=${encodeURIComponent(t)}&page_size=6`)
                      .then((r) => r.json())
                      .then((j) => setCustomerOptions(j.data || []))
                      .catch(() => setCustomerOptions([]));
                  }}
                />
                {customerOptions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
                    {customerOptions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        // onMouseDown for the same blur-before-click reason as
                        // the product dropdown.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCustomerId(c.id); setCustomerName(c.name); setCustomerPhone(c.phone || "");
                          setCustomerEmail(c.email || ""); setCustomerSearch(""); setCustomerOptions([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-pearl transition-colors"
                      >
                        <span className="text-charcoal">{c.name}</span>
                        <span className="text-charcoal-lighter text-xs ml-2">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input placeholder="Customer name *" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerId(null); }} />
                <Input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                <Input placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                <Input placeholder="Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-charcoal">Products</p>
                <AdminButton variant="outline" size="xs" onClick={() => setLines((l) => [...l, newLine()])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add line
                </AdminButton>
              </div>

              {lines.map((l, idx) => {
                const c = totals.perLine[idx];
                return (
                  <div key={l.key} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 relative">
                        {l.product ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-charcoal">{l.product.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setLine(l.key, { product: null, product_name: "", variant_id: null, variant_name: null, unit_price: "" });
                                setSearch((s) => ({ ...s, [l.key]: "" }));
                                setOptions((s) => ({ ...s, [l.key]: [] }));
                              }}
                              className="text-charcoal-lighter hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            <Input
                              className="h-9"
                              placeholder="Search by product name or SKU, or type a custom line"
                              value={search[l.key] ?? ""}
                              onChange={(e) => searchProducts(l.key, e.target.value)}
                              autoComplete="off"
                            />
                            {(options[l.key] || []).length > 0 && (
                              <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
                                {(options[l.key] || []).map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    // onMouseDown, not onClick: the input's blur
                                    // fires first on click and can tear down the
                                    // dropdown before the click registers, which
                                    // made selecting a product appear to do nothing.
                                    onMouseDown={(e) => { e.preventDefault(); pickProduct(l.key, p); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-pearl transition-colors border-b border-border/30 last:border-0"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-charcoal truncate">{p.name}</span>
                                      <span className="text-charcoal shrink-0">{formatCurrency(p.price)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-charcoal-lighter">
                                      {p.sku && <span>SKU {p.sku}</span>}
                                      {p.variants.length > 0 && <span>· {p.variants.length} variant{p.variants.length === 1 ? "" : "s"}</span>}
                                      <span>· stock {p.stock_quantity ?? 0}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {lines.length > 1 && (
                        <AdminButton variant="ghost" size="xs" onClick={() => setLines((list) => list.filter((x) => x.key !== l.key))}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </AdminButton>
                      )}
                    </div>

                    {l.product && l.product.variants.length > 0 && (
                      <Select value={l.variant_id || "none"} onValueChange={(v) => pickVariant(l.key, v === "none" ? "" : v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose a variant" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No variant</SelectItem>
                          {l.product.variants.map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.name}: {v.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-charcoal-lighter mb-1">Qty</label>
                        <Input className="h-9" type="number" min="1" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] text-charcoal-lighter mb-1">Unit price</label>
                        <Input className="h-9" type="number" min="0" step="0.01" value={l.unit_price} onChange={(e) => setLine(l.key, { unit_price: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-[10px] text-charcoal-lighter mb-1">Discount</label>
                        <div className="flex gap-1">
                          <Input className="h-9" type="number" min="0" step="0.01" value={l.discount_value} onChange={(e) => setLine(l.key, { discount_value: e.target.value })} />
                          <Select value={l.discount_type} onValueChange={(v) => setLine(l.key, { discount_type: v as DiscountType })}>
                            <SelectTrigger className="h-9 w-16 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="amount">৳</SelectItem>
                              <SelectItem value="percent">%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-charcoal-lighter mb-1">Line total</label>
                        <div className="h-9 flex items-center px-2 rounded-lg bg-pearl text-sm font-medium text-charcoal [font-variant-numeric:tabular-nums]">
                          {formatCurrency(c?.total ?? 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Seal & signature */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-charcoal">Seal &amp; signature</p>
              <p className="text-xs text-charcoal-lighter">
                Uploaded once and reused on every invoice. Both are optional — remove either to leave it off the document.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {([["seal", seal, setSeal], ["signature", signature, setSignature]] as const).map(([kind, val, setter]) => (
                  <div key={kind} className="rounded-xl border border-dashed border-border p-3 text-center">
                    <p className="text-xs font-medium text-charcoal capitalize mb-2">{kind}</p>
                    {val ? (
                      <div className="space-y-2">
                        <div className="relative h-20 w-full">
                          <Image src={val} alt={kind} fill className="object-contain" unoptimized />
                        </div>
                        <AdminButton variant="ghost" size="xs" onClick={() => { setter(""); rememberStamp(kind === "seal" ? { seal_url: "" } : { signature_url: "" }); }}>
                          <X className="h-3 w-3 mr-1" /> Remove
                        </AdminButton>
                      </div>
                    ) : (
                      <label className="cursor-pointer inline-flex flex-col items-center gap-1 py-3 text-charcoal-lighter hover:text-secondary transition-colors">
                        {uploading === kind ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                        <span className="text-[11px]">Upload {kind}</span>
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, kind); }} />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary + options */}
        <div className="space-y-5">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-charcoal">Summary</p>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-charcoal-lighter mb-1">Order discount</label>
                  <div className="flex gap-1">
                    <Input className="h-9" type="number" min="0" step="0.01" placeholder="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                      <SelectTrigger className="h-9 w-16 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">৳</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-charcoal-lighter mb-1">Delivery charge</label>
                  <Input className="h-9" type="number" min="0" step="0.01" placeholder="0" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} />
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-charcoal-lighter"><span>Subtotal</span><span className="text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(totals.subtotal)}</span></div>
                {totals.lineDiscountTotal > 0 && (
                  <div className="flex justify-between text-success"><span>Line discounts</span><span className="[font-variant-numeric:tabular-nums]">− {formatCurrency(totals.lineDiscountTotal)}</span></div>
                )}
                {totals.orderDiscount > 0 && (
                  <div className="flex justify-between text-success"><span>Order discount</span><span className="[font-variant-numeric:tabular-nums]">− {formatCurrency(totals.orderDiscount)}</span></div>
                )}
                {totals.delivery > 0 && (
                  <div className="flex justify-between text-charcoal-lighter"><span>Delivery</span><span className="text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(totals.delivery)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-border font-heading text-base font-bold text-charcoal">
                  <span>Total</span><span className="[font-variant-numeric:tabular-nums]">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-charcoal">Options</p>

              <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-charcoal">Include in stock &amp; accounting</p>
                  <p className="text-xs text-charcoal-lighter mt-0.5">
                    When on, marking this invoice paid deducts stock and counts it as revenue. Leave off for a quotation
                    or a sale accounted for elsewhere.
                  </p>
                </div>
                <Switch checked={affectsInventory} onCheckedChange={setAffectsInventory} />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-charcoal">Generate order number</p>
                  <p className="text-xs text-charcoal-lighter mt-0.5">
                    Takes the next number from Order Management and prints it as a reference. It does not create an
                    order, so nothing appears in the order list.
                  </p>
                </div>
                <Switch checked={generateOrderNo} onCheckedChange={setGenerateOrderNo} />
              </div>

              <Textarea placeholder="Notes (printed on the invoice)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <AdminButton onClick={() => save(false)} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save draft
            </AdminButton>
            <AdminButton variant="outline" onClick={() => save(true)} disabled={saving} className="w-full">
              <Printer className="h-3.5 w-3.5 mr-1" /> Save &amp; print
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}
