"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { HeroSection } from "@/components/storefront/home/hero-section";
import { CategoryShowcaseServer } from "@/components/storefront/home/category-showcase-server";
import { ProductSection, clampRows, clampColumns } from "@/components/storefront/home/product-section";
import { useCategories } from "@/hooks/queries/use-categories";
import { RecentlyViewedSection } from "@/components/storefront/recently-viewed-section";
import { BrandStory } from "@/components/storefront/home/brand-story";
import { TrustBadges } from "@/components/storefront/home/trust-badges";
import { PromoBannerStrip, CategoryBanner, PopupBanner } from "@/components/storefront/home/promo-banner";
import { useNewArrivals, useBestsellers, useTrendingProducts, usePreorderProducts } from "@/hooks/queries/use-products";

// Always below the fold (positions 11-14 in the default section order) —
// split into their own chunks instead of the initial homepage bundle. Still
// server-rendered when reached (no ssr:false) since these have no client-only
// state that would break in SSR, just deferred loading.
const ReviewsMarquee = dynamic(() => import("@/components/storefront/home/reviews-marquee").then((m) => m.ReviewsMarquee));
const InstagramFeed = dynamic(() => import("@/components/storefront/home/instagram-feed").then((m) => m.InstagramFeed));
const BrandsMarquee = dynamic(() => import("@/components/storefront/home/brands-marquee").then((m) => m.BrandsMarquee));
const FaqSection = dynamic(() => import("@/components/storefront/home/faq-section").then((m) => m.FaqSection));

interface SectionConfig {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  visible: boolean;
  order: number;
  /** Product-listing sections only (Homepage Builder): grid rows to show. */
  rows?: number;
  /** Product-listing sections only: desktop column count (clamped 2–6). */
  columns?: number;
  /** Product-listing sections only: continuous right-to-left auto-scroll instead of the grid. */
  scroll?: boolean;
}

interface TrustBadgeConfig {
  title: string;
  description: string;
}

interface HomepageConfig {
  sections: SectionConfig[];
  trust_badges: TrustBadgeConfig[];
}

// Default config — used if DB has no config yet
const defaultSections: SectionConfig[] = [
  { id: "s1", type: "hero", title: "", subtitle: "", visible: true, order: 1 },
  { id: "s2", type: "categories", title: "", subtitle: "", visible: true, order: 2 },
  { id: "s3", type: "new_arrivals", title: "New Arrivals", subtitle: "The latest additions to our collection", visible: true, order: 3, rows: 2, columns: 4, scroll: false },
  { id: "s4", type: "trust_badges", title: "", subtitle: "", visible: true, order: 4 },
  { id: "s5", type: "bestsellers", title: "Best Sellers", subtitle: "Loved by our customers", visible: true, order: 5, rows: 2, columns: 4, scroll: false },
  { id: "s6", type: "brand_story", title: "", subtitle: "", visible: true, order: 6 },
  { id: "s7", type: "trending", title: "Trending Now", subtitle: "What everyone is talking about", visible: true, order: 7, rows: 2, columns: 4, scroll: false },
  { id: "s8", type: "preorder", title: "Pre-Order", subtitle: "Be the first to own the latest launches", visible: true, order: 8, rows: 1, columns: 4, scroll: false },
  { id: "s9", type: "promo_banner", title: "", subtitle: "", visible: true, order: 9 },
  { id: "s10", type: "category_banner", title: "", subtitle: "", visible: true, order: 10 },
  { id: "s11", type: "reviews", title: "", subtitle: "", visible: true, order: 11 },
  { id: "s12", type: "instagram", title: "", subtitle: "", visible: true, order: 12 },
  { id: "s13", type: "brands", title: "", subtitle: "", visible: true, order: 13 },
  { id: "s14", type: "faq", title: "", subtitle: "", visible: false, order: 14 },
  { id: "s15", type: "popup_banner", title: "", subtitle: "", visible: true, order: 15 },
];

export function HomeClient({ initialConfig = null }: { initialConfig?: HomepageConfig | null }) {
  // Seed from the server-fetched config so the very first paint already has the
  // admin's real section order — no post-mount reorder (which caused CLS).
  const [config, setConfig] = useState<HomepageConfig | null>(initialConfig);

  useEffect(() => {
    // Already have the config from the server — skip the redundant client fetch.
    if (initialConfig) return;
    fetch("/api/settings?key=homepage_config")
      .then((r) => r.json())
      .then((data) => {
        if (data?.value) setConfig(data.value);
      })
      .catch(() => {});
  }, [initialConfig]);

  // Merge saved config with defaults so new section types (e.g. brands) appear
  const sections = (() => {
    if (!config?.sections?.length) return defaultSections;
    const savedTypes = new Set(config.sections.map((s) => s.type));
    const newSections = defaultSections.filter((s) => !savedTypes.has(s.type));
    if (newSections.length === 0) return config.sections;
    const usedIds = new Set(config.sections.map((s) => s.id));
    const maxOrder = Math.max(...config.sections.map((s) => s.order), 0);
    return [
      ...config.sections,
      ...newSections.map((s, i) => ({
        ...s,
        id: usedIds.has(s.id) ? `s${Date.now()}-${i}` : s.id,
        order: maxOrder + i + 1,
      })),
    ];
  })();
  const trustBadges = config?.trust_badges;
  const visibleSections = sections.filter((s) => s.visible).sort((a, b) => a.order - b.order);

  const getSection = (type: string) => visibleSections.find((s) => s.type === type);

  // Per-section layout settings from the Homepage Builder, with per-type
  // defaults for configs saved before these fields existed. The fetch limit
  // follows the layout: exactly rows × columns for a grid, a capped 24 for
  // scroll mode (its marquee shows everything fetched, and 24 keeps the
  // duplicated-content loop from turning into hundreds of DOM nodes).
  const layoutFor = (type: string, defRows: number) => {
    const s = sections.find((x) => x.type === type);
    const rows = clampRows(s?.rows, defRows);
    const columns = clampColumns(s?.columns, 4);
    const scroll = !!s?.scroll;
    return { rows, columns, scroll, limit: scroll ? 24 : rows * columns };
  };
  const newLayout = layoutFor("new_arrivals", 2);
  const bestLayout = layoutFor("bestsellers", 2);
  const trendLayout = layoutFor("trending", 2);
  const preorderLayout = layoutFor("preorder", 1);

  const { data: newArrivals, isLoading: loadingNew } = useNewArrivals(newLayout.limit);
  const { data: bestsellers, isLoading: loadingBest } = useBestsellers(bestLayout.limit);
  const { data: trending, isLoading: loadingTrending } = useTrendingProducts(trendLayout.limit);
  const { data: preorders, isLoading: loadingPreorder } = usePreorderProducts(preorderLayout.limit);
  // Categories come from the SSR-hydrated cache (prefetched in page.tsx), so the
  // grid renders on the first paint. Rendered via the framer-free server
  // component so the LCP image isn't gated on framer-motion booting.
  const { data: categoriesData } = useCategories();

  const renderSection = (section: SectionConfig) => {
    switch (section.type) {
      case "hero":
        return <HeroSection key={section.id} />;
      case "categories":
        return <CategoryShowcaseServer key={section.id} categories={categoriesData || []} />;
      case "new_arrivals":
        return (
          <ProductSection
            key={section.id}
            title={section.title || "New Arrivals"}
            subtitle={section.subtitle || "The latest additions to our collection"}
            products={newArrivals}
            isLoading={loadingNew}
            viewAllHref="/collections/new-arrivals"
            rows={newLayout.rows}
            columns={newLayout.columns}
            scroll={newLayout.scroll}
          />
        );
      case "trust_badges":
        return <TrustBadges key={section.id} badges={trustBadges} />;
      case "bestsellers":
        return (
          <ProductSection
            key={section.id}
            title={section.title || "Best Sellers"}
            subtitle={section.subtitle || "Loved by our customers"}
            products={bestsellers}
            isLoading={loadingBest}
            viewAllHref="/collections/bestsellers"
            rows={bestLayout.rows}
            columns={bestLayout.columns}
            scroll={bestLayout.scroll}
          />
        );
      case "brand_story":
        return <BrandStory key={section.id} />;
      case "trending":
        return (
          <ProductSection
            key={section.id}
            title={section.title || "Trending Now"}
            subtitle={section.subtitle || "What everyone is talking about"}
            products={trending}
            isLoading={loadingTrending}
            viewAllHref="/collections/trending"
            rows={trendLayout.rows}
            columns={trendLayout.columns}
            scroll={trendLayout.scroll}
          />
        );
      case "preorder":
        return (
          <div key={section.id} className="bg-pearl">
            <ProductSection
              title={section.title || "Pre-Order"}
              subtitle={section.subtitle || "Be the first to own the latest launches"}
              products={preorders}
              isLoading={loadingPreorder}
              viewAllHref="/categories/pre-orders"
              rows={preorderLayout.rows}
              columns={preorderLayout.columns}
              scroll={preorderLayout.scroll}
            />
          </div>
        );
      case "promo_banner":
        return <PromoBannerStrip key={section.id} />;
      case "category_banner":
        return <CategoryBanner key={section.id} />;
      case "popup_banner":
        return <PopupBanner key={section.id} />;
      case "reviews":
        return <ReviewsMarquee key={section.id} />;
      case "instagram":
        return <InstagramFeed key={section.id} />;
      case "brands":
        return <BrandsMarquee key={section.id} />;
      case "faq":
        return <FaqSection key={section.id} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Guaranteed homepage h1 for SEO. The hero carousel's title is an h1 too,
          but it only renders when slides are configured — this ensures the
          homepage always has exactly one top-level heading with the core BD
          intent terms. sr-only so it doesn't alter the visual design. */}
      <h1 className="sr-only">
        ChineXa — Original Korean Skincare &amp; Beauty in Bangladesh
      </h1>
      {visibleSections.map(renderSection)}
      {/* Client-only, personalized — rendered unconditionally at the end rather
          than through the admin section config. Self-hides when empty. */}
      <RecentlyViewedSection />
    </>
  );
}
