"use client";

import { useState, useEffect } from "react";
import { SlidersHorizontal, X, PackageSearch, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useProducts } from "@/hooks/queries/use-products";
import { useCategories } from "@/hooks/queries/use-categories";
import { cn } from "@/lib/utils";
import type { ProductListParams } from "@/types/product";

export default function ProductsPage() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [params, setParams] = useState<ProductListParams>({
    page: 1,
    page_size: 12,
    sort_by: "featured",
  });
  const [priceRange, setPriceRange] = useState([0, 30000]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]); // brand names
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  const { data, isLoading } = useProducts(params);
  const { data: categories } = useCategories();

  // Active brands for the brand filter (names are what the API matches on).
  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBrands(data.filter((b: { is_active: boolean }) => b.is_active).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })));
      })
      .catch(() => {});
  }, []);

  const updateParams = (updates: Partial<ProductListParams>) => {
    setParams((prev) => ({ ...prev, ...updates, page: 1 }));
  };

  const toggleBrand = (name: string) => {
    const next = selectedBrands.includes(name) ? selectedBrands.filter((b) => b !== name) : [...selectedBrands, name];
    setSelectedBrands(next);
    updateParams({ brand: next.length > 0 ? next.join(",") : undefined });
  };

  const clearAll = () => {
    setParams({ page: 1, page_size: 12, sort_by: "featured" });
    setPriceRange([0, 30000]);
    setSelectedBrands([]);
  };

  const mainCategories = categories?.filter((c) => !c.parent_id) || [];

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h4 className="text-sm font-semibold text-charcoal mb-3">Categories</h4>
        <div className="space-y-2">
          {mainCategories.map((cat) => (
            <label
              key={cat.id}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-pearl"
            >
              <Checkbox
                checked={params.category === cat.id}
                onCheckedChange={(checked) =>
                  updateParams({ category: checked ? cat.id : undefined })
                }
              />
              <span className="text-sm text-charcoal-light">{cat.name}</span>
              <span className="ml-auto text-xs text-charcoal-lighter">({cat.product_count})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="text-sm font-semibold text-charcoal mb-3">Price Range</h4>
        <Slider
          value={priceRange}
          onValueChange={setPriceRange}
          min={0}
          max={30000}
          step={500}
          className="mb-3"
        />
        <div className="flex justify-between text-xs text-charcoal-lighter">
          <span>৳{priceRange[0].toLocaleString()}</span>
          <span>৳{priceRange[1].toLocaleString()}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={() => updateParams({ min_price: priceRange[0], max_price: priceRange[1] })}
        >
          Apply Price Filter
        </Button>
      </div>

      {/* Brand */}
      {brands.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-charcoal mb-3">Brand</h4>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {brands.map((b) => (
              <label key={b.id} className="flex items-center gap-2 cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-pearl">
                <Checkbox checked={selectedBrands.includes(b.name)} onCheckedChange={() => toggleBrand(b.name)} />
                <span className="text-sm text-charcoal-light">{b.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Rating */}
      <div>
        <h4 className="text-sm font-semibold text-charcoal mb-3">Rating</h4>
        <div className="space-y-1.5">
          {[4, 3, 2].map((r) => (
            <button
              key={r}
              onClick={() => updateParams({ min_rating: params.min_rating === r ? undefined : r })}
              className={cn(
                "flex items-center gap-1.5 w-full rounded-lg px-2 py-1.5 text-sm transition-colors",
                params.min_rating === r ? "bg-primary-light text-charcoal" : "text-charcoal-light hover:bg-pearl"
              )}
            >
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn("h-3.5 w-3.5", i < r ? "text-gold fill-gold" : "text-border")} />
                ))}
              </span>
              <span className="text-xs text-charcoal-lighter">&amp; up</span>
            </button>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div>
        <h4 className="text-sm font-semibold text-charcoal mb-3">Availability</h4>
        <label className="flex items-center gap-2 cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-pearl">
          <Checkbox checked={!!params.in_stock} onCheckedChange={(checked) => updateParams({ in_stock: checked ? true : undefined })} />
          <span className="text-sm text-charcoal-light">In stock only</span>
        </label>
      </div>

      {/* Clear Filters */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-destructive"
        onClick={clearAll}
      >
        <X className="h-3.5 w-3.5 mr-1" /> Clear All Filters
      </Button>
    </div>
  );

  return (
    <div className="bg-card min-h-screen">
      {/* Header */}
      <div className="bg-hero-gradient py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "All Products" }]} />
          {/* Heading renders immediately (no load fade) — it's the above-fold
              text and shouldn't wait on framer-motion. */}
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mt-4">
            All Products
          </h1>
          <p className="text-charcoal-lighter mt-2">
            {data?.total || 0} products to explore
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="font-heading text-lg font-semibold text-charcoal mb-6">Filters</h3>
              <FilterContent />
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4 mr-1" /> Filters
              </Button>

              <div className="flex items-center gap-3 ml-auto">
                <Select
                  value={params.sort_by}
                  onValueChange={(val) => updateParams({ sort_by: val as ProductListParams["sort_by"] })}
                >
                  <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="name_asc">Name: A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[3/4] rounded-xl sm:rounded-2xl" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : Array.isArray(data?.data) && data.data.length > 0 ? (
              // Plain wrapper (not a fading motion.div): each ProductCard runs
              // its own whileInView fade-up stagger; a grid-level opacity fade
              // would mask that cascade. Key remounts on page/sort/filter change.
              <div
                key={`${params.page}-${params.sort_by}-${params.category}-${params.brand}-${params.min_rating}-${params.in_stock}`}
                className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6"
              >
                {data.data.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} priority={index === 0} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={PackageSearch}
                title="No products found"
                description="Try adjusting your filters or check back later for new arrivals."
                actionLabel="Clear All Filters"
                onAction={() => {
                  setParams({ page: 1, page_size: 12, sort_by: "featured" });
                  setPriceRange([0, 30000]);
                }}
              />
            )}

            {/* Pagination */}
            {data && data.total_pages > 1 && (
              <Pagination
                currentPage={data.page}
                totalPages={data.total_pages}
                onPageChange={(page) => setParams((prev) => ({ ...prev, page }))}
                className="mt-12"
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription className="sr-only">Filter products</SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <FilterContent />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
