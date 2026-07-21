"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Package, AlertTriangle, CheckCircle2, XCircle, Warehouse,
  TrendingDown, TrendingUp, DollarSign, Minus, Plus, Check,
  X, Download, RefreshCw, Edit, History
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";
import { backdropClose } from "@/lib/modal-backdrop";
import { useAdmin } from "@/contexts/admin-context";

interface StockProduct {
  id: string; name: string; sku: string; stock: number; min_stock: number; max_stock: number; price: number;
  category: string; is_active: boolean; image: string; stock_value: number; status: "out" | "low" | "over" | "ok";
  last_restocked_at?: string | null;
}

interface StockVariant {
  id: string; name: string; sku: string; stock: number; price_adjustment: number; hex?: string;
}

interface HistoryEntry {
  id: number; variant_sku: string | null; variant_name: string | null;
  event_type: "added" | "restock" | "adjust"; quantity_change: number;
  resulting_stock: number | null; note: string | null; created_at: string;
}

interface StockSummary {
  total_products: number; out_of_stock: number; low_stock: number;
  healthy_stock: number; over_stock: number; total_units: number; total_stock_value: number;
}

export default function StockManagementPage() {
  const { can } = useAdmin();
  const canEditStock = can("stock", "edit");
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("stock_asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Edit panel
  const [editProduct, setEditProduct] = useState<StockProduct | null>(null);
  const [editStock, setEditStock] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editMaxStock, setEditMaxStock] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Variant-aware editing: the product's variants + which one is selected
  // ("" = edit product-level stock/price). Restock history for the current
  // selection (product-level or the chosen variant).
  const [variants, setVariants] = useState<StockVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;

  const fetchStock = async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ filter, sort_by: sortBy, page: String(page), page_size: "20" });
      if (searchQuery) sp.set("search", searchQuery);
      if (category !== "all") sp.set("category", category);
      const res = await fetch(`/api/stock?${sp.toString()}`);
      const data = await res.json();
      setProducts(data.data || []);
      setSummary(data.summary || null);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchStock(); }, [filter, sortBy, page, category]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); fetchStock(); }, 300); return () => clearTimeout(t); }, [searchQuery]);

  const handleRefresh = async () => { setRefreshing(true); await fetchStock(); setTimeout(() => setRefreshing(false), 500); };

  // Load restock/addition history for the current selection (product-level, or
  // a specific variant SKU).
  const loadHistory = async (productId: string, variantSku?: string | null) => {
    setHistoryLoading(true);
    try {
      const sp = new URLSearchParams({ product_id: productId });
      if (variantSku) sp.set("variant_sku", variantSku);
      const res = await fetch(`/api/stock/history?${sp.toString()}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); } finally { setHistoryLoading(false); }
  };

  const openEdit = async (product: StockProduct) => {
    setEditProduct(product);
    setSelectedVariantId("");
    setVariants([]);
    setEditStock(String(product.stock));
    setEditPrice(String(product.price));
    setEditMinStock(String(product.min_stock));
    setEditMaxStock(String(product.max_stock));
    setSaved(false);
    setHistory([]);
    // Product-level history immediately; variants + variant history are loaded
    // in the background so the panel opens instantly.
    loadHistory(product.id, null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}`);
      const data = await res.json();
      if (Array.isArray(data?.variants) && data.variants.length > 0) {
        setVariants(data.variants.map((v: Record<string, unknown>) => ({
          id: v.id as string,
          name: v.name as string,
          sku: v.sku as string,
          stock: Number(v.stock) || 0,
          price_adjustment: Number(v.price_adjustment) || 0,
          hex: (v.hex as string) || undefined,
        })));
      }
    } catch { /* no variants — product-level editing only */ } finally { setDetailLoading(false); }
  };

  // When the variant selection changes, swap the stock/price fields to that
  // selection and reload its history. "" = product level.
  const selectVariant = (variantId: string) => {
    if (!editProduct) return;
    setSelectedVariantId(variantId);
    setSaved(false);
    if (variantId === "") {
      setEditStock(String(editProduct.stock));
      setEditPrice(String(editProduct.price));
      loadHistory(editProduct.id, null);
    } else {
      const v = variants.find((x) => x.id === variantId);
      if (v) {
        setEditStock(String(v.stock));
        setEditPrice(String(editProduct.price + v.price_adjustment));
        loadHistory(editProduct.id, v.sku);
      }
    }
  };

  const handleSaveAll = async () => {
    if (!editProduct) return;
    setSaving(true);

    try {
      if (selectedVariant) {
        // ─── Variant-level save ───
        const newStock = Number.isFinite(Number(editStock)) && editStock !== "" ? Number(editStock) : selectedVariant.stock;
        // The variant's price is stored as an adjustment off the product's base
        // price; convert the entered absolute price back to an adjustment.
        const newAbsPrice = Number.isFinite(Number(editPrice)) && editPrice !== "" ? Number(editPrice) : (editProduct.price + selectedVariant.price_adjustment);
        const newAdjustment = newAbsPrice - editProduct.price;
        const body: Record<string, number> = {};
        if (newStock !== selectedVariant.stock) body.stock = newStock;
        if (newAdjustment !== selectedVariant.price_adjustment) body.price_adjustment = newAdjustment;
        if (Object.keys(body).length > 0) {
          const res = await fetch(`/api/products/${editProduct.id}/variants/${selectedVariant.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          });
          if (!res.ok) { setSaving(false); return; }
        }
        // Reflect locally + refresh this variant's history.
        setVariants((prev) => prev.map((v) => v.id === selectedVariant.id ? { ...v, stock: newStock, price_adjustment: newAdjustment } : v));
        await loadHistory(editProduct.id, selectedVariant.sku);
      } else {
        // ─── Product-level save (stock / price / thresholds) ───
        const newStock = Number.isFinite(Number(editStock)) && editStock !== "" ? Number(editStock) : editProduct.stock;
        const newPrice = Number.isFinite(Number(editPrice)) && editPrice !== "" ? Number(editPrice) : editProduct.price;
        const newMin = Number.isFinite(Number(editMinStock)) && editMinStock !== "" ? Number(editMinStock) : editProduct.min_stock;
        const newMax = Number.isFinite(Number(editMaxStock)) && editMaxStock !== "" ? Number(editMaxStock) : editProduct.max_stock;
        const promises: Promise<Response>[] = [];
        if (newStock !== editProduct.stock) promises.push(fetch("/api/stock", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editProduct.id, stock: newStock, name: editProduct.name }) }));
        if (newPrice !== editProduct.price) promises.push(fetch("/api/stock", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editProduct.id, price: newPrice, name: editProduct.name }) }));
        if (newMin !== editProduct.min_stock || newMax !== editProduct.max_stock) promises.push(fetch("/api/stock", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editProduct.id, min_stock: newMin, max_stock: newMax, name: editProduct.name }) }));
        await Promise.all(promises);
        const newStatus: StockProduct["status"] = newStock === 0 ? "out" : newStock <= newMin ? "low" : newStock > newMax ? "over" : "ok";
        setProducts((prev) => prev.map((p) => p.id === editProduct.id ? { ...p, stock: newStock, price: newPrice, min_stock: newMin, max_stock: newMax, stock_value: newPrice * newStock, status: newStatus } : p));
        setEditProduct((prev) => prev ? { ...prev, stock: newStock, price: newPrice, min_stock: newMin, max_stock: newMax } : prev);
        await loadHistory(editProduct.id, null);
      }
    } catch {
      setSaving(false);
      return; // network failure — keep panel open, don't optimistically update
    }

    setSaving(false);
    setSaved(true);

    // Refresh the whole list + summary (a variant restock can flip the product's
    // status / last-restocked date).
    fetchStock();
  };

  const adjustStock = (amount: number) => {
    const current = Number(editStock);
    setEditStock(String(Math.max(0, (Number.isFinite(current) ? current : 0) + amount)));
  };

  const stats = [
    { label: "Total Products", value: summary?.total_products || 0, icon: Package, color: "text-charcoal", bg: "bg-pearl" },
    { label: "Out of Stock", value: summary?.out_of_stock || 0, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Low Stock", value: summary?.low_stock || 0, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
    { label: "Healthy", value: summary?.healthy_stock || 0, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Overstock", value: summary?.over_stock || 0, icon: TrendingDown, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Stock Value", value: formatCurrency(summary?.total_stock_value || 0), icon: DollarSign, color: "text-gold", bg: "bg-gold/10" },
  ];

  const filterTabs = [
    { id: "all", label: "All Products", count: summary?.total_products || 0 },
    { id: "out", label: "Out of Stock", count: summary?.out_of_stock || 0 },
    { id: "low", label: "Low Stock", count: summary?.low_stock || 0 },
    { id: "overstock", label: "Overstock", count: summary?.over_stock || 0 },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Stock Management</h1>
          <p className="text-sm text-charcoal-lighter">{total} products · {(summary?.total_units || 0).toLocaleString()} units</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> {refreshing ? "Refreshing..." : "Refresh"}
          </AdminButton>
          <AdminButton variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export</AdminButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]"><CardContent className="p-3 flex items-center gap-2.5">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", s.bg)}><s.icon className={cn("h-3.5 w-3.5", s.color)} /></div>
            <div><p className="text-base font-bold text-charcoal leading-tight [font-variant-numeric:tabular-nums]">{s.value}</p><p className="text-[9px] text-charcoal-lighter">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button key={tab.id} onClick={() => { setFilter(tab.id); setPage(1); }}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-[0.96]",
              filter === tab.id ? "bg-charcoal !text-white" : "bg-pearl text-charcoal-lighter hover:text-charcoal")}>
            {tab.label}
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", filter === tab.id ? "bg-white/20" : "bg-white")}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <div className="p-3 border-b border-border/20">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Search by name or SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4" />} className="flex-1" />
            <div className="flex gap-2">
              <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
                <SelectTrigger className="w-1/2 sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="skincare">Skincare</SelectItem>
                  <SelectItem value="bags">Bags</SelectItem>
                  <SelectItem value="jewels">Jewels</SelectItem>
                  <SelectItem value="perfumes">Perfumes</SelectItem>
                  <SelectItem value="shoes">Shoes</SelectItem>
                  <SelectItem value="imported">Imported</SelectItem>
                  <SelectItem value="preorder">Pre-Orders</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="w-1/2 sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_asc">Stock: Low → High</SelectItem>
                  <SelectItem value="stock_desc">Stock: High → Low</SelectItem>
                  <SelectItem value="name_asc">Name: A → Z</SelectItem>
                  <SelectItem value="value_desc">Value: High → Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/20 text-left">
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Product</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Stock</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">Price</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Value</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden lg:table-cell">Last Restocked</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/10"><td className="px-4 py-3" colSpan={7}><Skeleton className="h-10 w-full" /></td></tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="p-0">
                  <EmptyState icon={Package} title="No products found" description="Try adjusting your search or filters to find what you're looking for." />
                </td></tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id}
                    onClick={() => openEdit(product)}
                    className={cn("group border-b border-border/10 hover:bg-primary-light/30 transition-colors cursor-pointer", product.stock === 0 && "bg-destructive/3")}>
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-pearl shrink-0">
                          <Image src={product.image} alt={product.name} fill className="object-cover" sizes="40px" />
                          {product.stock === 0 && <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center"><XCircle className="h-4 w-4 text-destructive" /></div>}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-charcoal text-xs truncate max-w-[180px]">{product.name}</p>
                          <p className="text-[9px] text-charcoal-lighter">{product.sku} · {product.category}</p>
                        </div>
                      </div>
                    </td>
                    {/* Stock */}
                    <td className="px-4 py-3 [font-variant-numeric:tabular-nums]">
                      <span className={cn("text-sm font-bold", product.status === "out" ? "text-destructive" : product.status === "low" ? "text-warning" : product.status === "over" ? "text-blue-500" : "text-charcoal")}>
                        {product.stock}
                      </span>
                      <p className="text-[8px] text-charcoal-lighter">{product.min_stock}–{product.max_stock}</p>
                    </td>
                    {/* Price */}
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(product.price)}</td>
                    {/* Value */}
                    <td className="px-4 py-3 hidden md:table-cell text-xs font-medium text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(product.stock_value)}</td>
                    {/* Last Restocked */}
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-charcoal-light">
                      {product.last_restocked_at ? formatDateShort(product.last_restocked_at) : <span className="text-charcoal-lighter">—</span>}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant={product.status === "out" ? "destructive" : product.status === "low" ? "warning" : product.status === "over" ? "secondary" : "success"} className="text-[9px]">
                        {product.status === "out" ? "Out" : product.status === "low" ? "Low" : product.status === "over" ? "Over" : "OK"}
                      </Badge>
                    </td>
                    {/* Edit hint */}
                    <td className="px-4 py-3">
                      <Edit className="h-3.5 w-3.5 text-charcoal-lighter transition-colors group-hover:text-charcoal" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-border/20">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      {/* ═══════ EDIT PANEL (Slide-over) ═══════ */}
      <AnimatePresence>
        {editProduct && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-sm" onClick={backdropClose(() => setEditProduct(null))} />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-[0_0_60px_rgba(0,0,0,0.15)] flex flex-col"
            >
              {/* Panel Header — full product name + SKU (no truncation) */}
              <div className="flex items-start justify-between gap-3 p-5 border-b border-border/20">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-pearl shrink-0">
                    <Image src={editProduct.image} alt={editProduct.name} fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-charcoal leading-snug break-words">{editProduct.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[11px] font-mono text-charcoal-light break-all">{editProduct.sku}</span>
                      <span className="text-[10px] text-charcoal-lighter">· {editProduct.category}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setEditProduct(null)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors active:scale-[0.96] shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Panel Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Variant selector — choose WHICH variant (or the whole product)
                    to update before editing its stock/price. Shown only when the
                    product actually has variants. */}
                {(variants.length > 0 || detailLoading) && (
                  <div>
                    <label className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2.5 block">
                      {detailLoading ? "Loading variants…" : "Select what to update"}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => selectVariant("")}
                        className={cn("px-3 py-2 rounded-luxury text-xs font-medium border transition-all active:scale-[0.96]",
                          selectedVariantId === "" ? "bg-secondary !text-white border-secondary" : "bg-white text-charcoal border-border hover:border-charcoal")}>
                        Whole product
                      </button>
                      {variants.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => selectVariant(v.id)}
                          className={cn("flex items-center gap-1.5 px-3 py-2 rounded-luxury text-xs font-medium border transition-all active:scale-[0.96]",
                            selectedVariantId === v.id ? "bg-secondary !text-white border-secondary" : "bg-white text-charcoal border-border hover:border-charcoal")}>
                          {v.hex && <span className="h-3 w-3 rounded-full border border-border/40 shrink-0" style={{ backgroundColor: v.hex }} />}
                          {v.name}
                          <span className={cn("text-[9px] [font-variant-numeric:tabular-nums]", selectedVariantId === v.id ? "text-white/80" : "text-charcoal-lighter")}>({v.stock})</span>
                        </button>
                      ))}
                    </div>
                    {selectedVariant && (
                      <p className="mt-2 text-[10px] text-charcoal-lighter font-mono break-all">Editing variant SKU: {selectedVariant.sku}</p>
                    )}
                    <Separator className="mt-4" />
                  </div>
                )}

                {/* Stock Quantity */}
                <div>
                  <label className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-3 block">
                    {selectedVariant ? `${selectedVariant.name} — Stock` : "Stock Quantity"}
                  </label>
                  <div className="flex items-center justify-center gap-1.5 sm:gap-3 mb-3">
                    <button onClick={() => adjustStock(-10)} className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-pearl text-xs sm:text-sm font-medium text-charcoal-lighter hover:text-charcoal transition-colors active:scale-[0.96]">-10</button>
                    <button onClick={() => adjustStock(-1)} className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-pearl transition-colors active:scale-[0.96]">
                      <Minus className="h-4 w-4 sm:h-5 sm:w-5 text-charcoal-lighter" />
                    </button>
                    <input
                      type="number"
                      value={editStock}
                      onChange={(e) => setEditStock(e.target.value)}
                      className={cn("w-16 sm:w-24 h-12 sm:h-16 text-center text-xl sm:text-3xl font-bold rounded-luxury border-2 focus:outline-none focus:ring-4 transition-all min-w-0 [font-variant-numeric:tabular-nums]",
                        Number(editStock) === 0 ? "border-destructive text-destructive focus:ring-destructive/20" :
                        Number(editStock) <= Number(editMinStock) ? "border-warning text-warning focus:ring-warning/20" :
                        "border-border text-charcoal focus:border-secondary focus:ring-secondary/20"
                      )}
                    />
                    <button onClick={() => adjustStock(1)} className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-pearl transition-colors active:scale-[0.96]">
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-charcoal-lighter" />
                    </button>
                    <button onClick={() => adjustStock(10)} className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-pearl text-xs sm:text-sm font-medium text-charcoal-lighter hover:text-charcoal transition-colors active:scale-[0.96]">+10</button>
                  </div>
                  {/* Quick set buttons */}
                  <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
                    {[0, 5, 10, 25, 50, 100].map((v) => (
                      <button key={v} onClick={() => setEditStock(String(v))}
                        className={cn("px-2.5 sm:px-3 py-1.5 rounded-luxury text-xs font-medium transition-all active:scale-[0.96] [font-variant-numeric:tabular-nums]",
                          Number(editStock) === v ? "bg-charcoal !text-white" : "bg-pearl text-charcoal-lighter hover:bg-charcoal/5 hover:text-charcoal"
                        )}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Price */}
                <div>
                  <label className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-3 block">
                    {selectedVariant ? `${selectedVariant.name} — Unit Price` : "Unit Price"}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-charcoal-lighter font-medium">৳</span>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="flex-1 h-14 text-center text-2xl font-bold rounded-luxury border-2 border-border text-charcoal focus:border-secondary focus:outline-none focus:ring-4 focus:ring-secondary/20 transition-all [font-variant-numeric:tabular-nums]"
                    />
                  </div>
                  <p className="text-[10px] text-charcoal-lighter text-center mt-2">
                    Stock Value: <span className="font-semibold text-charcoal">{formatCurrency(Number(editPrice) * Number(editStock))}</span>
                  </p>
                </div>

                {!selectedVariant && <Separator />}

                {/* Stock Thresholds — product-level only */}
                {!selectedVariant && (
                <div>
                  <label className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-3 block">Stock Alert Thresholds</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-charcoal-lighter mb-1.5">Low Stock Alert (Min)</p>
                      <input
                        type="number"
                        value={editMinStock}
                        onChange={(e) => setEditMinStock(e.target.value)}
                        className="w-full h-11 text-center text-lg font-semibold rounded-lg border border-warning/30 bg-warning/5 text-warning focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/20 transition-all [font-variant-numeric:tabular-nums]"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-charcoal-lighter mb-1.5">Overstock Alert (Max)</p>
                      <input
                        type="number"
                        value={editMaxStock}
                        onChange={(e) => setEditMaxStock(e.target.value)}
                        className="w-full h-11 text-center text-lg font-semibold rounded-lg border border-blue-300/30 bg-blue-50 text-blue-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all [font-variant-numeric:tabular-nums]"
                      />
                    </div>
                  </div>
                  {/* Visual range */}
                  <div className="mt-3 flex items-center gap-1 text-[9px]">
                    <span className="text-destructive font-medium">0 (Out)</span>
                    <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-destructive/30 via-warning/30 via-30% via-success/30 via-70% to-blue-300/30 relative">
                      <div className="absolute top-full mt-0.5 text-[8px] text-warning font-medium" style={{ left: `${Math.min((Number(editMinStock) / Math.max(Number(editMaxStock) * 1.5, 1)) * 100, 90)}%` }}>↑{editMinStock}</div>
                      <div className="absolute top-full mt-0.5 text-[8px] text-blue-500 font-medium" style={{ left: `${Math.min((Number(editMaxStock) / Math.max(Number(editMaxStock) * 1.5, 1)) * 100, 95)}%` }}>↑{editMaxStock}</div>
                    </div>
                    <span className="text-blue-500 font-medium">Over</span>
                  </div>
                </div>
                )}

                <Separator />

                {/* ─── Restock / Addition History ─── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <History className="h-3.5 w-3.5 text-charcoal-lighter" />
                    <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                      {selectedVariant ? `${selectedVariant.name} History` : "Stock History"}
                    </label>
                  </div>
                  {historyLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-[11px] text-charcoal-lighter py-3 text-center bg-pearl/40 rounded-lg">
                      No stock history yet{selectedVariant ? " for this variant" : ""}. Additions and restocks will appear here.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((h) => {
                        const isAdd = h.event_type === "added";
                        const isUp = h.quantity_change > 0;
                        return (
                          <div key={h.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-pearl/50 border border-border/20">
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-full shrink-0",
                              isAdd ? "bg-secondary/10 text-secondary" : isUp ? "bg-success/10 text-success" : "bg-charcoal/5 text-charcoal-lighter")}>
                              {isAdd ? <Plus className="h-3.5 w-3.5" /> : isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-charcoal">
                                {isAdd ? "Added" : isUp ? "Restocked" : "Reduced"}
                                <span className={cn("ml-1.5 [font-variant-numeric:tabular-nums]", isUp ? "text-success" : "text-charcoal-lighter")}>
                                  {isUp ? "+" : ""}{h.quantity_change}
                                </span>
                                {h.resulting_stock != null && (
                                  <span className="text-charcoal-lighter"> → {h.resulting_stock} in stock</span>
                                )}
                              </p>
                              <p className="text-[10px] text-charcoal-lighter">
                                {formatDateShort(h.created_at)}{h.note ? ` · ${h.note}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Panel Footer */}
              <div className="border-t border-border/20 p-5 space-y-3">
                {saved && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 p-2 rounded-lg bg-success/10 text-success text-sm font-medium">
                    <Check className="h-4 w-4" /> All changes saved!
                  </motion.div>
                )}
                <div className="flex gap-3">
                  <AdminButton variant="outline" className="flex-1" onClick={() => setEditProduct(null)}>Cancel</AdminButton>
                  {canEditStock && (
                    <AdminButton className="flex-1" onClick={handleSaveAll} disabled={saving}>
                      {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
                    </AdminButton>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
