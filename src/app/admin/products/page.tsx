"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Package, Check, X,
  ExternalLink, AlertTriangle, EyeOff, RotateCcw, DollarSign, ChevronDown,
  ChevronRight, Loader2, Save
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { useProducts } from "@/hooks/queries/use-products";
import { formatCurrency, cn } from "@/lib/utils";
import type { ProductListParams, Product, ProductVariant } from "@/types/product";

export default function AdminProductsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [params, setParams] = useState<ProductListParams>({ page: 1, page_size: 10, sort_by: "newest" });
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Variant modals
  const [viewVariant, setViewVariant] = useState<{ variant: ProductVariant; product: Product } | null>(null);
  const [editVariant, setEditVariant] = useState<{ variant: ProductVariant; product: Product } | null>(null);
  const [deleteVariant, setDeleteVariant] = useState<{ variant: ProductVariant; product: Product } | null>(null);
  const [editVName, setEditVName] = useState("");
  const [editVValue, setEditVValue] = useState("");
  const [editVPrice, setEditVPrice] = useState("");
  const [editVStock, setEditVStock] = useState("");
  const [editVSku, setEditVSku] = useState("");
  const [variantSaving, setVariantSaving] = useState(false);

  const { data, isLoading, refetch } = useProducts({ ...params, search: searchQuery || undefined, all: true });

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Real API calls
  const handleDelete = async () => {
    if (!deleteProduct) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/products/${deleteProduct.id}`, { method: "DELETE" });
      setDeleteProduct(null);
      refetch();
    } catch {} finally { setDeleteLoading(false); }
  };

  const handleToggleStatus = async (product: Product) => {
    const newActive = !product.is_active;
    await fetch(`/api/products/${product.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: newActive }),
    });
    refetch();
  };

  const openEditVariant = (variant: ProductVariant, product: Product) => {
    setEditVariant({ variant, product });
    setEditVName(variant.name);
    setEditVValue(variant.value);
    setEditVPrice(String(variant.price_adjustment));
    setEditVStock(String(variant.stock));
    setEditVSku(variant.sku);
  };

  const handleSaveVariant = async () => {
    if (!editVariant) return;
    setVariantSaving(true);
    try {
      await fetch(`/api/products/${editVariant.product.id}/variants/${editVariant.variant.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editVName.trim(), value: editVValue.trim(),
          price_adjustment: Number(editVPrice) || 0,
          stock: Number(editVStock) || 0, sku: editVSku.trim(),
        }),
      });
      setEditVariant(null);
      refetch();
    } catch {} finally { setVariantSaving(false); }
  };

  const handleDeleteVariant = async () => {
    if (!deleteVariant) return;
    await fetch(`/api/products/${deleteVariant.product.id}/variants/${deleteVariant.variant.id}`, { method: "DELETE" });
    setDeleteVariant(null);
    refetch();
  };

  const allProducts = data?.data || [];
  const activeProducts = allProducts.filter((p) => p.is_active);
  const inactiveProducts = allProducts.filter((p) => !p.is_active);
  const displayProducts = activeTab === "active" ? activeProducts : inactiveProducts;

  const ProductRow = ({ product }: { product: Product }) => {
    const hasVariants = product.variants.length > 1;
    const isExpanded = expandedRows.has(product.id);
    const singleVariant = product.variants.length === 1 ? product.variants[0] : null;

    return (
      <>
        <tr className={cn("border-b border-border/10 hover:bg-pearl/50 transition-colors", !product.is_active && "opacity-70")}>
          {/* Expand toggle + Product */}
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              {hasVariants ? (
                <button onClick={() => toggleExpand(product.id)} className="p-0.5 hover:bg-pearl rounded transition-colors shrink-0">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-charcoal-lighter" /> : <ChevronRight className="h-4 w-4 text-charcoal-lighter" />}
                </button>
              ) : (
                <div className="w-5" />
              )}
              <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3 group">
                <div className="relative h-11 w-11 rounded-lg overflow-hidden bg-pearl shrink-0">
                  <Image src={product.images[0]?.url || "https://placehold.co/44x44"} alt={product.name} fill className="object-cover" sizes="44px" unoptimized={product.images[0]?.url?.includes("/uploads/")} />
                  {!product.is_active && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><EyeOff className="h-4 w-4 text-charcoal-lighter" /></div>}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-charcoal truncate max-w-[200px] group-hover:text-secondary transition-colors">{product.name}</p>
                  <p className="text-[10px] text-charcoal-lighter">{product.sku}{hasVariants ? ` · ${product.variants.length} variants` : ""}</p>
                </div>
              </Link>
            </div>
          </td>

          {/* Category */}
          <td className="px-4 py-3 hidden sm:table-cell">
            <span className="text-xs text-charcoal-light">{product.category_name}</span>
          </td>

          {/* Price */}
          <td className="px-4 py-3">
            {hasVariants ? (
              <div>
                <p className="text-xs text-charcoal-lighter">From</p>
                <p className="font-medium text-charcoal">{formatCurrency(product.price)}</p>
              </div>
            ) : singleVariant ? (
              <p className="font-medium text-charcoal">{formatCurrency(product.price + singleVariant.price_adjustment)}</p>
            ) : (
              <div>
                <p className="font-medium text-charcoal">{formatCurrency(product.price)}</p>
                {product.compare_at_price && <p className="text-[10px] text-charcoal-lighter line-through">{formatCurrency(product.compare_at_price)}</p>}
              </div>
            )}
          </td>

          {/* Stock */}
          <td className="px-4 py-3 hidden md:table-cell">
            <span className={cn("text-xs font-medium", product.stock_quantity <= 5 ? "text-destructive" : product.stock_quantity <= 20 ? "text-warning" : "text-charcoal-light")}>
              {product.stock_quantity}
            </span>
          </td>

          {/* Status */}
          <td className="px-4 py-3 hidden md:table-cell">
            <Badge variant={product.is_active ? "success" : "destructive"} className="text-[10px]">
              {product.is_active ? "Active" : "Inactive"}
            </Badge>
          </td>

          {/* Actions */}
          <td className="px-4 py-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="p-1.5 hover:bg-pearl rounded-lg transition-colors">
                <MoreHorizontal className="h-4 w-4 text-charcoal-lighter" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.open(`/products/${product.slug}`, "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" /> View on Store
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/admin/products/${product.id}`)}>
                  <Edit className="h-3.5 w-3.5 mr-2" /> Edit Product
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleToggleStatus(product)}>
                  {product.is_active ? <><EyeOff className="h-3.5 w-3.5 mr-2" /> Deactivate</> : <><RotateCcw className="h-3.5 w-3.5 mr-2" /> Reactivate</>}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteProduct(product)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Product
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>

        {/* Expanded Variants */}
        {hasVariants && isExpanded && product.variants.map((v) => (
          <tr key={v.id} className="bg-pearl/30 border-b border-border/10">
            <td className="px-4 py-2.5" colSpan={2}>
              <div className="flex items-center gap-3 ml-7">
                <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-pearl shrink-0 border border-border/20">
                  {v.image ? (
                    <Image src={v.image} alt={v.name} fill className="object-cover" sizes="36px" unoptimized={v.image.includes("/uploads/")} />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-charcoal-lighter/40" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-charcoal">{v.name}</span>
                    {v.hex && <span className="h-3 w-3 rounded-full border border-border/30 shrink-0" style={{ backgroundColor: v.hex }} />}
                    <Badge variant="outline" className="text-[8px]">{v.type}</Badge>
                  </div>
                  <p className="text-[9px] text-charcoal-lighter font-mono">{v.sku}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-2.5">
              <p className="text-xs font-medium text-charcoal">
                {formatCurrency(product.price + v.price_adjustment)}
              </p>
              {v.price_adjustment !== 0 && (
                <p className="text-[9px] text-charcoal-lighter">{v.price_adjustment > 0 ? "+" : ""}{formatCurrency(v.price_adjustment)}</p>
              )}
            </td>
            <td className="px-4 py-2.5 hidden md:table-cell">
              <span className={cn("text-xs font-medium", v.stock <= 5 ? "text-destructive" : v.stock <= 20 ? "text-warning" : "text-charcoal-light")}>
                {v.stock}
              </span>
            </td>
            <td className="px-4 py-2.5 hidden md:table-cell" />
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-1">
                <button onClick={() => setViewVariant({ variant: v, product })} className="p-1 hover:bg-white rounded text-charcoal-lighter hover:text-charcoal transition-colors" title="View">
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => openEditVariant(v, product)} className="p-1 hover:bg-white rounded text-charcoal-lighter hover:text-secondary transition-colors" title="Edit">
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setDeleteVariant({ variant: v, product })} className="p-1 hover:bg-white rounded text-charcoal-lighter hover:text-destructive transition-colors" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  };

  const tableHead = (
    <tr className="border-b border-border/30 text-left">
      <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Product</th>
      <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">Category</th>
      <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Price</th>
      <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Stock</th>
      <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Status</th>
      <th className="px-4 py-3 w-12"></th>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Products</h1>
          <p className="text-sm text-charcoal-lighter">{data?.total || 0} total products</p>
        </div>
        <Link href="/admin/products/new"><AdminButton><Plus className="h-4 w-4" /> Add Product</AdminButton></Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4">
        {(["active", "inactive"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-all duration-200", activeTab === tab ? "border-secondary text-secondary" : "border-transparent text-charcoal-lighter hover:text-charcoal")}>
            {tab === "active" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {tab === "active" ? "Active" : "Inactive"}
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", activeTab === tab ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter")}>
              {tab === "active" ? activeProducts.length : inactiveProducts.length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4" />} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead>{tableHead}</thead>
                <tbody>{Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="px-4 py-3"><div className="flex items-center gap-3 ml-7"><Skeleton className="h-11 w-11 rounded-lg" /><div><Skeleton className="h-4 w-40 mb-1" /><Skeleton className="h-3 w-20" /></div></div></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-6 w-6" /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="py-12">
              <EmptyState icon={activeTab === "active" ? Package : EyeOff}
                title={activeTab === "active" ? "No active products" : "No inactive products"}
                description={activeTab === "active" ? "Add your first product or reactivate from the Inactive tab." : "Deactivated products will appear here."} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>{tableHead}</thead>
                <tbody>{displayProducts.map((product) => <ProductRow key={product.id} product={product} />)}</tbody>
              </table>
            </div>
          )}

          {data && data.total_pages > 1 && (
            <div className="p-4 border-t border-border/30">
              <Pagination currentPage={data.page} totalPages={data.total_pages} onPageChange={(page) => setParams((p) => ({ ...p, page }))} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Product Dialog */}
      <Dialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Product</DialogTitle>
            <DialogDescription>This will permanently delete the product, all its variants, images, and reviews.</DialogDescription>
          </DialogHeader>
          {deleteProduct && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-pearl/60">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-pearl shrink-0">
                <Image src={deleteProduct.images[0]?.url || "https://placehold.co/48x48"} alt={deleteProduct.name} fill className="object-cover" sizes="48px" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{deleteProduct.name}</p>
                <p className="text-xs text-charcoal-lighter">{deleteProduct.sku} · {deleteProduct.variants.length} variant{deleteProduct.variants.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteProduct(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Variant Modal */}
      <Dialog open={!!viewVariant} onOpenChange={(open) => !open && setViewVariant(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Variant Details</DialogTitle></DialogHeader>
          {viewVariant && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-pearl/60">
                <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-pearl shrink-0 border border-border/20">
                  {viewVariant.variant.image ? (
                    <Image src={viewVariant.variant.image} alt={viewVariant.variant.name} fill className="object-cover" sizes="64px" unoptimized={viewVariant.variant.image.includes("/uploads/")} />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><Package className="h-6 w-6 text-charcoal-lighter/40" /></div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-charcoal">{viewVariant.variant.name}</p>
                    {viewVariant.variant.hex && <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: viewVariant.variant.hex }} />}
                  </div>
                  <Badge variant="outline" className="text-[9px] mt-1">{viewVariant.variant.type}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-charcoal-lighter uppercase">Product</p><p className="font-medium text-charcoal">{viewVariant.product.name}</p></div>
                <div><p className="text-[10px] text-charcoal-lighter uppercase">Value</p><p className="text-charcoal">{viewVariant.variant.value}</p></div>
                <div><p className="text-[10px] text-charcoal-lighter uppercase">Price</p><p className="font-medium text-charcoal">{formatCurrency(viewVariant.product.price + viewVariant.variant.price_adjustment)}</p></div>
                <div><p className="text-[10px] text-charcoal-lighter uppercase">Adjustment</p><p className="text-charcoal">{viewVariant.variant.price_adjustment > 0 ? "+" : ""}{formatCurrency(viewVariant.variant.price_adjustment)}</p></div>
                <div><p className="text-[10px] text-charcoal-lighter uppercase">Stock</p><p className={cn("font-medium", viewVariant.variant.stock <= 5 ? "text-destructive" : "text-charcoal")}>{viewVariant.variant.stock}</p></div>
                <div><p className="text-[10px] text-charcoal-lighter uppercase">SKU</p><p className="text-charcoal font-mono text-xs">{viewVariant.variant.sku}</p></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setViewVariant(null)}>Close</AdminButton>
            <AdminButton size="sm" onClick={() => { if (viewVariant) { openEditVariant(viewVariant.variant, viewVariant.product); setViewVariant(null); } }}>
              <Edit className="h-3.5 w-3.5" /> Edit
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Variant Modal */}
      <Dialog open={!!editVariant} onOpenChange={(open) => !open && setEditVariant(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Variant</DialogTitle>
            <DialogDescription>{editVariant?.product.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input label="Variant Name" value={editVName} onChange={(e) => setEditVName(e.target.value)} placeholder="e.g., 50ml" />
            <Input label="Value" value={editVValue} onChange={(e) => setEditVValue(e.target.value)} placeholder="e.g., 50ml" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Price Adjustment (৳)" type="number" value={editVPrice} onChange={(e) => setEditVPrice(e.target.value)} />
              <Input label="Stock" type="number" value={editVStock} onChange={(e) => setEditVStock(e.target.value)} />
            </div>
            <Input label="SKU" value={editVSku} onChange={(e) => setEditVSku(e.target.value)} />
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setEditVariant(null)}>Cancel</AdminButton>
            <AdminButton onClick={handleSaveVariant} disabled={variantSaving}>
              {variantSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Variant Dialog */}
      <Dialog open={!!deleteVariant} onOpenChange={(open) => !open && setDeleteVariant(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Variant</DialogTitle>
            <DialogDescription>Remove &quot;{deleteVariant?.variant.name}&quot; from {deleteVariant?.product.name}?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteVariant(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDeleteVariant}><Trash2 className="h-3.5 w-3.5" /> Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
