"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useProductsByCategory, useProducts } from "@/hooks/queries/use-products";
import { useCategory } from "@/hooks/queries/use-categories";
import type { ProductListParams } from "@/types/product";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: category } = useCategory(slug);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [params, setParams] = useState<ProductListParams>({
    page: 1,
    page_size: 12,
    sort_by: "featured",
    category: slug,
  });
  const [priceRange, setPriceRange] = useState([0, 30000]);
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>(undefined);
  const [brands, setBrands] = useState<{ id: string; name: string; logo?: string }[]>([]);

  useEffect(() => {
    fetch("/api/brands").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setBrands(data.filter((b: Record<string, unknown>) => b.is_active).map((b: Record<string, unknown>) => ({ id: b.id as string, name: b.name as string, logo: (b.logo as string) || undefined })));
    }).catch(() => {});
  }, []);

  const { data, isLoading } = useProducts(params);

  const updateParams = (updates: Partial<ProductListParams>) => {
    setParams((prev) => ({ ...prev, ...updates, page: 1 }));
  };

  const subcategories = category?.children || [];

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Subcategories */}
      {subcategories.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-charcoal mb-3">Subcategories</h4>
          <div className="space-y-2">
            {subcategories.map((sub) => (
              <label key={sub.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={params.subcategory === sub.slug}
                  onCheckedChange={(checked) =>
                    updateParams({ subcategory: checked ? sub.slug : undefined })
                  }
                />
                <span className="text-sm text-charcoal-light">{sub.name}</span>
                <span className="ml-auto text-xs text-charcoal-lighter">({sub.product_count})</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
          Apply
        </Button>
      </div>

      {/* Clear */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-destructive"
        onClick={() => {
          setParams({ page: 1, page_size: 12, sort_by: "featured", category: slug });
          setPriceRange([0, 30000]);
        }}
      >
        <X className="h-3.5 w-3.5 mr-1" /> Clear Filters
      </Button>
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Category Header */}
      <div className="relative bg-hero-gradient overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10">
          <Breadcrumb items={[{ label: category?.name || slug }]} />
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal mt-4"
          >
            {category?.name || slug}
          </motion.h1>
          {category?.description && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-charcoal-lighter mt-3 max-w-2xl"
            >
              {category.description}
            </motion.p>
          )}
          <p className="text-sm text-charcoal-lighter mt-2">
            {data?.total || 0} products
          </p>
        </div>
        {/* Background image */}
        {category?.image && (
          <div className="absolute inset-0 opacity-10">
            <Image src={category.image} alt="" fill className="object-cover" sizes="100vw" />
          </div>
        )}
      </div>

      {/* Brands Pills */}
      {brands.length > 0 && (
        <div className="border-b border-border/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedBrand(undefined)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  !selectedBrand
                    ? "bg-secondary text-white shadow-[0_4px_15px_rgba(192,57,43,0.25)]"
                    : "bg-pearl text-charcoal-lighter hover:bg-primary-light hover:text-charcoal"
                }`}
              >
                All Brands
              </button>
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrand(selectedBrand === brand.name ? undefined : brand.name)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    selectedBrand === brand.name
                      ? "bg-secondary text-white shadow-[0_4px_15px_rgba(192,57,43,0.25)]"
                      : "bg-pearl text-charcoal-lighter hover:bg-primary-light hover:text-charcoal"
                  }`}
                >
                  {brand.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Desktop Filters */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="font-heading text-base font-semibold text-charcoal mb-4">Filters</h3>
              <FilterContent />
            </div>
          </aside>

          {/* Products */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 gap-4">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal className="h-4 w-4 mr-1" /> Filters
              </Button>
              <div className="flex items-center gap-3 ml-auto">
                <Select
                  value={params.sort_by}
                  onValueChange={(v) => updateParams({ sort_by: v as ProductListParams["sort_by"] })}
                >
                  <SelectTrigger className="w-44 h-9 text-xs">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[3/4] rounded-2xl" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : (() => {
              const filtered = selectedBrand
                ? (data?.data || []).filter((p) => (p as unknown as { brand_name?: string }).brand_name === selectedBrand)
                : data?.data || [];
              return filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-charcoal-lighter">No products found{selectedBrand ? ` for ${selectedBrand}` : " in this category"}.</p>
              </div>
            ) : (
              <motion.div
                key={`${params.page}-${params.sort_by}-${params.subcategory}-${selectedBrand}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6"
              >
                {filtered.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </motion.div>
            );
            })()}

            {data && data.total_pages > 1 && (
              <Pagination
                currentPage={data.page}
                totalPages={data.total_pages}
                onPageChange={(page) => setParams((p) => ({ ...p, page }))}
                className="mt-12"
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription className="sr-only">Filter products</SheetDescription>
          </SheetHeader>
          <div className="p-6"><FilterContent /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
