"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Download, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useAdmin } from "@/contexts/admin-context";

interface ImportBatch {
  id: string; product_id: string; product_name: string; quantity_imported: number;
  import_cost_total: number; shipping_cost: number; customs_cost: number; other_cost: number;
  landed_cost_per_unit: number; batch_date: string; notes: string | null;
}
interface ProductOption { id: string; name: string; }

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ImportBatchesTab() {
  const { can } = useAdmin();
  const canAdd = can("accounting", "add");
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [quantity, setQuantity] = useState("");
  const [importCost, setImportCost] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [customsCost, setCustomsCost] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/accounting/import-batches?page_size=100");
      const json = await res.json();
      if (!res.ok) { setError(json?.error || "Failed to load import batches"); return; }
      setBatches(json.data || []);
    } catch {
      setError("Network error — could not load import batches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  useEffect(() => {
    if (productSearch.trim().length < 2) { setProductOptions([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(productSearch)}&all=1&page_size=10`)
        .then((r) => r.json())
        .then((json) => setProductOptions((json.data || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
        .catch(() => setProductOptions([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [productSearch]);

  const landedCostPreview = useMemo(() => {
    const qty = Number(quantity);
    if (!qty || qty < 1) return null;
    const total = (Number(importCost) || 0) + (Number(shippingCost) || 0) + (Number(customsCost) || 0) + (Number(otherCost) || 0);
    return Math.round((total / qty) * 100) / 100;
  }, [quantity, importCost, shippingCost, customsCost, otherCost]);

  const openDialog = () => {
    setSelectedProduct(null);
    setProductSearch("");
    setProductOptions([]);
    setQuantity(""); setImportCost(""); setShippingCost(""); setCustomsCost(""); setOtherCost("");
    setBatchDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedProduct) { setFormError("Select a product"); return; }
    if (!quantity || Number(quantity) < 1) { setFormError("Quantity must be at least 1"); return; }
    if (!importCost || Number(importCost) <= 0) { setFormError("Import cost is required"); return; }
    if (!batchDate) { setFormError("Batch date is required"); return; }
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/import-batches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id, quantity_imported: Number(quantity), import_cost_total: Number(importCost),
          shipping_cost: Number(shippingCost) || 0, customs_cost: Number(customsCost) || 0, other_cost: Number(otherCost) || 0,
          batch_date: batchDate, notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setFormError(json?.error || "Failed to record import batch"); return; }
      setDialogOpen(false);
      fetchBatches();
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const csv = toCsv(
      ["Product", "Quantity", "Import Cost", "Shipping", "Customs", "Other", "Landed Cost/Unit", "Date"],
      batches.map((b) => [b.product_name, b.quantity_imported, b.import_cost_total, b.shipping_cost, b.customs_cost, b.other_cost, b.landed_cost_per_unit, formatDate(b.batch_date)])
    );
    downloadCsv(csv, "import-batches.csv");
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <AdminButton variant="outline" onClick={handleExport} disabled={batches.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export
        </AdminButton>
        {canAdd && (
          <AdminButton onClick={openDialog}>
            <Plus className="h-4 w-4 mr-1" /> Record Import Batch
          </AdminButton>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader><CardTitle className="text-lg">Import Batch History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5"><Skeleton className="h-32 w-full" /></div>
          ) : batches.length === 0 ? (
            <p className="text-sm text-charcoal-lighter py-6 text-center">No import batches recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left">
                    <th className="px-4 py-3 font-medium text-charcoal-lighter">Product</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter text-right">Qty</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter text-right hidden sm:table-cell">Total Cost</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter text-right">Landed Cost/Unit</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-b border-border/20 hover:bg-pearl/50">
                      <td className="px-4 py-3 text-charcoal">{b.product_name}</td>
                      <td className="px-4 py-3 text-right text-charcoal-lighter">{b.quantity_imported}</td>
                      <td className="px-4 py-3 text-right text-charcoal-lighter hidden sm:table-cell">
                        {formatCurrency(b.import_cost_total + b.shipping_cost + b.customs_cost + b.other_cost)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-secondary">{formatCurrency(b.landed_cost_per_unit)}</td>
                      <td className="px-4 py-3 text-charcoal-lighter hidden md:table-cell">{formatDate(b.batch_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Import Batch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Product<span className="text-destructive"> *</span></label>
              {selectedProduct ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/30 bg-pearl/30">
                  <span className="text-sm text-charcoal">{selectedProduct.name}</span>
                  <button onClick={() => setSelectedProduct(null)} className="text-xs text-secondary hover:underline">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Search product by name..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    icon={<Search className="h-4 w-4" />}
                  />
                  {productOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-white shadow-lg max-h-48 overflow-y-auto">
                      {productOptions.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedProduct(p); setProductOptions([]); }}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-pearl/50 transition-colors"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Quantity Imported" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" required />
              <Input label="Batch Date" type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Import Cost (৳)" type="number" value={importCost} onChange={(e) => setImportCost(e.target.value)} placeholder="50000" required />
              <Input label="Shipping (৳)" type="number" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="5000" />
              <Input label="Customs (৳)" type="number" value={customsCost} onChange={(e) => setCustomsCost(e.target.value)} placeholder="3000" />
            </div>
            <Input label="Other Cost (৳, optional)" type="number" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} placeholder="0" />
            <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" />

            {landedCostPreview !== null && (
              <div className="rounded-lg bg-secondary/5 border border-secondary/20 px-4 py-3">
                <p className="text-sm text-charcoal">
                  Landed cost per unit will be <span className="font-bold text-secondary">{formatCurrency(landedCostPreview)}</span>
                </p>
                <p className="text-xs text-charcoal-lighter mt-0.5">This will update the product&apos;s cost price automatically.</p>
              </div>
            )}

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
