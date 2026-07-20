"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { SlidersHorizontal, X, Award, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useProducts } from "@/hooks/queries/use-products";
import { useBrand } from "@/hooks/queries/use-brands";
import type { ProductListParams } from "@/types/product";
import { normalizeWebsite } from "@/lib/utils";

export default function BrandPage() {
  const shouldReduceMotion = useReducedMotion();
  const { slug } = useParams<{ slug: string }>();
  const { data: brand, isLoading: brandLoading } = useBrand(slug);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 30000]);
  const [params, setParams] = useState<ProductListParams>({
    page: 1,
    page_size: 12,
    sort_by: "featured",
  });

  // Once the brand resolves, filter the product grid to it (products API
  // matches on brand_name) — mirrors the previous setParams-on-fetch timing,
  // just driven off useBrand's cache instead of a local useEffect+fetch.
  useEffect(() => {
    if (brand?.name) {
      setParams((prev) => (prev.brand === brand.name ? prev : { ...prev, brand: brand.name }));
    }
  }, [brand?.name]);

  const { data, isLoading, isFetching } = useProducts(params);

  const updateParams = (updates: Partial<ProductListParams>) => {
    setParams((prev) => ({ ...prev, ...updates, page: 1 }));
  };

  const FilterContent = () => (
    <div className="space-y-6">
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
          setParams({ page: 1, page_size: 12, sort_by: "featured", brand: brand?.name });
          setPriceRange([0, 30000]);
        }}
      >
        <X className="h-3.5 w-3.5 mr-1" /> Clear Filters
      </Button>
    </div>
  );

  if (brandLoading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="bg-hero-gradient">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-10 w-64 mb-3" />
            <Skeleton className="h-5 w-full max-w-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <EmptyState
          icon={Award}
          title="Brand Not Found"
          description="The brand you are looking for does not exist."
        />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Brand Header */}
      <div className="relative bg-hero-gradient overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10">
          <Breadcrumb items={[{ label: "Brands", href: "/brands" }, { label: brand.name }]} />

          <div className="flex items-start gap-6 mt-4">
            {/* Brand Logo */}
            {brand.logo && (
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                className="hidden sm:block shrink-0"
              >
                <div className="animate-float relative h-20 w-20 lg:h-24 lg:w-24 rounded-2xl bg-white border border-border/20 overflow-hidden shadow-sm">
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    fill
                    className="object-contain p-2"
                    sizes="96px"
                    unoptimized={brand.logo.includes("/uploads/")}
                  />
                </div>
              </motion.div>
            )}

            <div className="flex-1 min-w-0">
              <motion.h1
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal"
              >
                {brand.name}
              </motion.h1>

              {brand.description && (
                <motion.p
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-charcoal-lighter mt-2 max-w-2xl"
                >
                  {brand.description}
                </motion.p>
              )}

              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-wrap items-center gap-3 mt-3"
              >
                {brand.country && (
                  <span className="flex items-center gap-1 text-sm text-charcoal-lighter">
                    <Globe className="h-3.5 w-3.5" /> {brand.country}
                  </span>
                )}
                <span className="text-sm text-charcoal-lighter">
                  {data?.total || 0} products
                </span>
                {brand.website && (
                  <a
                    href={normalizeWebsite(brand.website) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-secondary hover:text-secondary-dark active:scale-[0.97] transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Website
                  </a>
                )}
              </motion.div>

              {brand.certifications.length > 0 && (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-wrap gap-1.5 mt-3"
                >
                  {brand.certifications.map((cert, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-white/60">
                      {cert}
                    </Badge>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Faded logo background */}
        {brand.logo && (
          <div className="absolute inset-0 opacity-5">
            <Image src={brand.logo} alt="" fill className="object-contain" sizes="100vw" />
          </div>
        )}
      </div>

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
                  <SelectTrigger className="w-36 sm:w-44 h-9 text-xs">
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
            ) : isFetching ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full border-[3px] border-pearl" />
                    <div className="absolute inset-0 h-10 w-10 rounded-full border-[3px] border-secondary border-t-transparent animate-spin" />
                  </div>
                  <p className="text-sm text-charcoal-lighter">Loading products...</p>
                </div>
              </div>
            ) : !data?.data?.length ? (
              <EmptyState
                icon={Award}
                title="No products found"
                description="This brand doesn't have any products matching your filters yet."
              />
            ) : (
              <motion.div
                key={`${params.page}-${params.sort_by}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6"
              >
                {data.data.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} priority={index === 0} />
                ))}
              </motion.div>
            )}

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
