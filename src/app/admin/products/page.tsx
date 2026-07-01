"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye, Package, Check, X, ExternalLink, AlertTriangle, Power, EyeOff, RotateCcw, DollarSign } from "lucide-react";
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
import type { ProductListParams, Product } from "@/types/product";

export default function AdminProductsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [params, setParams] = useState<ProductListParams>({
    page: 1,
    page_size: 10,
    sort_by: "newest",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [priceSaved, setPriceSaved] = useState<string | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [toggledIds, setToggledIds] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useProducts({
    ...params,
    search: searchQuery || undefined,
    all: true,
  });

  const handlePriceEdit = (productId: string, currentPrice: number) => {
    setEditingPrice(productId);
    setPriceValue(String(currentPrice));
  };

  const handlePriceSave = (productId: string) => {
    setEditingPrice(null);
    setPriceSaved(productId);
    setTimeout(() => setPriceSaved(null), 1500);
  };

  const handlePriceCancel = () => {
    setEditingPrice(null);
    setPriceValue("");
  };

  const handleDelete = () => {
    if (deleteProduct) {
      setDeletedIds((prev) => [...prev, deleteProduct.id]);
      setDeleteProduct(null);
    }
  };

  const handleToggleStatus = (productId: string, currentActive: boolean) => {
    setToggledIds((prev) => ({ ...prev, [productId]: !currentActive }));
  };

  const getProductStatus = (product: Product) => {
    if (toggledIds[product.id] !== undefined) return toggledIds[product.id];
    return product.is_active;
  };

  const allProducts = data?.data.filter((p) => !deletedIds.includes(p.id)) || [];
  const activeProducts = allProducts.filter((p) => getProductStatus(p));
  const inactiveProducts = allProducts.filter((p) => !getProductStatus(p));
  const displayProducts = activeTab === "active" ? activeProducts : inactiveProducts;

  const ProductRow = ({ product }: { product: Product }) => {
    const isActive = getProductStatus(product);
    return (
      <motion.tr
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, x: -30, height: 0 }}
        className={cn("border-b border-border/10 hover:bg-pearl/50 transition-colors", !isActive && "opacity-70")}
      >
        {/* Product */}
        <td className="px-4 py-3">
          <Link href={`/products/${product.slug}`} target="_blank" className="flex items-center gap-3 group">
            <div className="relative h-11 w-11 rounded-lg overflow-hidden bg-pearl shrink-0">
              <Image src={product.images[0]?.url || "https://placehold.co/44x44"} alt={product.name} fill className="object-cover" sizes="44px" />
              {!isActive && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                  <EyeOff className="h-4 w-4 text-charcoal-lighter" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-charcoal truncate max-w-[200px] group-hover:text-secondary transition-colors">{product.name}</p>
              <p className="text-[10px] text-charcoal-lighter">{product.sku}</p>
            </div>
          </Link>
        </td>

        {/* Category */}
        <td className="px-4 py-3 hidden sm:table-cell">
          <span className="text-xs text-charcoal-light">{product.category_name}</span>
        </td>

        {/* Price — inline editable */}
        <td className="px-4 py-3">
          <AnimatePresence mode="wait">
            {editingPrice === product.id ? (
              <motion.div key="editing-price" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1">
                <span className="text-xs text-charcoal-lighter">৳</span>
                <input type="number" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} className="w-20 h-7 text-center text-sm font-medium border border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/20" autoFocus />
                <button onClick={() => handlePriceSave(product.id)} className="h-7 w-7 flex items-center justify-center rounded-full bg-success text-white hover:bg-success/90 transition-colors"><Check className="h-3 w-3" /></button>
                <button onClick={handlePriceCancel} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-destructive/10 text-charcoal-lighter hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
              </motion.div>
            ) : (
              <motion.button key="display-price" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => handlePriceEdit(product.id, product.price)}
                className={cn("text-left cursor-pointer hover:text-secondary transition-colors", priceSaved === product.id && "text-success")}
                title="Click to edit price"
              >
                <p className="font-medium">{priceSaved === product.id ? "Saved!" : formatCurrency(product.price)}</p>
                {product.compare_at_price && <p className="text-[10px] text-charcoal-lighter line-through">{formatCurrency(product.compare_at_price)}</p>}
              </motion.button>
            )}
          </AnimatePresence>
        </td>

        {/* Stock */}
        <td className="px-4 py-3 hidden md:table-cell">
          <span className={cn(
            "text-xs font-medium",
            product.stock_quantity <= 5 ? "text-destructive" : product.stock_quantity <= 20 ? "text-warning" : "text-charcoal-light"
          )}>
            {product.stock_quantity}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3 hidden md:table-cell">
          <Badge variant={isActive ? "success" : "destructive"} className="text-[10px]">
            {isActive ? "Active" : "Inactive"}
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
              <DropdownMenuItem onClick={() => handlePriceEdit(product.id, product.price)}>
                <DollarSign className="h-3.5 w-3.5 mr-2" /> Update Price
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleToggleStatus(product.id, isActive)}>
                {isActive ? (
                  <><EyeOff className="h-3.5 w-3.5 mr-2" /> Deactivate</>
                ) : (
                  <><RotateCcw className="h-3.5 w-3.5 mr-2" /> Reactivate</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteProduct(product)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </motion.tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Products</h1>
          <p className="text-sm text-charcoal-lighter">{data?.total || 0} total products</p>
        </div>
        <Link href="/admin/products/new">
          <AdminButton><Plus className="h-4 w-4" /> Add Product</AdminButton>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-all duration-200",
            activeTab === "active"
              ? "border-secondary text-secondary"
              : "border-transparent text-charcoal-lighter hover:text-charcoal"
          )}
        >
          <Eye className="h-4 w-4" />
          Active
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            activeTab === "active" ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter"
          )}>
            {activeProducts.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("inactive")}
          className={cn(
            "flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-all duration-200",
            activeTab === "inactive"
              ? "border-secondary text-secondary"
              : "border-transparent text-charcoal-lighter hover:text-charcoal"
          )}
        >
          <EyeOff className="h-4 w-4" />
          Inactive
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            activeTab === "inactive" ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter"
          )}>
            {inactiveProducts.length}
          </span>
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4" />} />
            </div>
            <Select value={params.category || "all"} onValueChange={(val) => setParams((p) => ({ ...p, category: val === "all" ? undefined : val, page: 1 }))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left">
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">Category</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Stock</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Status</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-lg" /><div><Skeleton className="h-4 w-40 mb-1" /><Skeleton className="h-3 w-20" /></div></div></td>
                      <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-12" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-6 w-6" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={activeTab === "active" ? Package : EyeOff}
                title={activeTab === "active" ? "No active products" : "No inactive products"}
                description={activeTab === "active" ? "All products are currently inactive. Reactivate them from the Inactive tab." : "No products have been deactivated. Products you deactivate will appear here."}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left">
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">Category</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Stock</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Status</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {displayProducts.map((product) => (
                      <ProductRow key={product.id} product={product} />
                    ))}
                  </AnimatePresence>
                </tbody>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteProduct} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete Product
            </DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteProduct && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-pearl/60">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-pearl shrink-0">
                <Image src={deleteProduct.images[0]?.url || "https://placehold.co/48x48"} alt={deleteProduct.name} fill className="object-cover" sizes="48px" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{deleteProduct.name}</p>
                <p className="text-xs text-charcoal-lighter">{deleteProduct.sku} &middot; {formatCurrency(deleteProduct.price)}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-charcoal-light">Are you sure you want to permanently delete this product? All associated data including images, variants, and reviews will be removed.</p>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteProduct(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
