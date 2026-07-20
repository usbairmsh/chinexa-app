"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types/product";

// Admin-configurable bounds (Homepage Builder → section settings). Columns
// above 6 make cards too cramped even on wide desktops; a single column
// isn't a grid. Rows capped so one section can't swallow the homepage.
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 6;
export const MIN_ROWS = 1;
export const MAX_ROWS = 4;

export const clampColumns = (n: number | undefined, fallback = 4) =>
  Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(Number(n) || fallback)));
export const clampRows = (n: number | undefined, fallback = 2) =>
  Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(Number(n) || fallback)));

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  products?: Product[];
  isLoading?: boolean;
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Desktop column count (2–6). Phones always show 2, tablets 3 — cards resize fluidly with the grid. */
  columns?: number;
  /** Grid rows to show (1–4). Ignored when scroll is on. */
  rows?: number;
  /** Continuous right-to-left auto-scroll of every fetched product instead of the grid. */
  scroll?: boolean;
}

// Static class strings on purpose — Tailwind only generates classes it can
// see in source, so the desktop count maps to a literal, with phones fixed
// at 2 columns and tablets stepping up gradually.
const gridCols: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6",
};

export function ProductSection({
  title,
  subtitle,
  products,
  isLoading,
  viewAllHref,
  viewAllLabel = "View All",
  columns = 4,
  rows = 2,
  scroll = false,
}: ProductSectionProps) {
  const cols = clampColumns(columns);
  const rowCount = clampRows(rows);
  const gridProducts = (products || []).slice(0, rowCount * cols);
  const scrollProducts = products || [];
  // Same pacing rule as the brands marquee: bigger sets scroll longer so the
  // speed stays roughly constant regardless of product count.
  const marqueeDuration = Math.max(30, scrollProducts.length * 6);

  return (
    <section className="py-8 sm:py-10 lg:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold text-charcoal mb-1">
              {title}
            </h2>
            {subtitle && (
              <p className="text-charcoal-lighter text-sm sm:text-base">{subtitle}</p>
            )}
          </div>
          {viewAllHref && (
            <Link href={viewAllHref} className="hidden sm:flex">
              <Button variant="ghost" className="gap-1">
                {viewAllLabel} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </motion.div>
      </div>

      {isLoading ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`grid ${gridCols[cols]} gap-4 lg:gap-6`}>
            {Array.from({ length: cols * (scroll ? 1 : rowCount) }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-2xl" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : scroll ? (
        /* Right-to-left continuous marquee — same duplicated-content technique
           as the brands marquee. Pauses while hovered so the cards' own
           add-to-bag / wishlist actions stay usable. */
        <div className="overflow-hidden">
          <div
            // Longhand animation properties on purpose: the `animation`
            // shorthand would also set animation-play-state inline, which
            // outranks the hover class and would break pause-on-hover.
            className="flex gap-4 lg:gap-6 items-stretch hover:[animation-play-state:paused]"
            style={{
              animationName: "marquee",
              animationDuration: `${marqueeDuration}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              width: "max-content",
            }}
          >
            {[...scrollProducts, ...scrollProducts].map((product, i) => (
              <div key={`${product.id}-${i}`} className="w-[220px] sm:w-[250px] shrink-0">
                <ProductCard product={product} index={0} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`grid ${gridCols[cols]} gap-4 lg:gap-6`}>
            {gridProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      )}

      {viewAllHref && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mt-8 text-center sm:hidden">
            <Link href={viewAllHref}>
              <Button variant="outline" className="gap-1">
                {viewAllLabel} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
