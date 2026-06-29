"use client";

import { useState, useEffect } from "react";
import { HeroSection } from "@/components/storefront/home/hero-section";
import { CategoryShowcase } from "@/components/storefront/home/category-showcase";
import { ProductSection } from "@/components/storefront/home/product-section";
import { BrandStory } from "@/components/storefront/home/brand-story";
import { TrustBadges } from "@/components/storefront/home/trust-badges";
import { ReviewsMarquee } from "@/components/storefront/home/reviews-marquee";
import { InstagramFeed } from "@/components/storefront/home/instagram-feed";
import { FaqSection } from "@/components/storefront/home/faq-section";
import { PromoBannerStrip, CategoryBanner, PopupBanner } from "@/components/storefront/home/promo-banner";
import { useNewArrivals, useBestsellers, useTrendingProducts, usePreorderProducts } from "@/hooks/queries/use-products";

interface SectionConfig {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  visible: boolean;
  order: number;
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
  { id: "s3", type: "new_arrivals", title: "New Arrivals", subtitle: "The latest additions to our collection", visible: true, order: 3 },
  { id: "s4", type: "trust_badges", title: "", subtitle: "", visible: true, order: 4 },
  { id: "s5", type: "bestsellers", title: "Best Sellers", subtitle: "Loved by our customers", visible: true, order: 5 },
  { id: "s6", type: "brand_story", title: "", subtitle: "", visible: true, order: 6 },
  { id: "s7", type: "trending", title: "Trending Now", subtitle: "What everyone is talking about", visible: true, order: 7 },
  { id: "s8", type: "preorder", title: "Pre-Order", subtitle: "Be the first to own the latest launches", visible: true, order: 8 },
  { id: "s9", type: "promo_banner", title: "", subtitle: "", visible: true, order: 9 },
  { id: "s10", type: "category_banner", title: "", subtitle: "", visible: true, order: 10 },
  { id: "s11", type: "reviews", title: "", subtitle: "", visible: true, order: 11 },
  { id: "s12", type: "instagram", title: "", subtitle: "", visible: true, order: 12 },
  { id: "s13", type: "faq", title: "", subtitle: "", visible: true, order: 13 },
  { id: "s14", type: "popup_banner", title: "", subtitle: "", visible: true, order: 14 },
];

export default function HomePage() {
  const { data: newArrivals, isLoading: loadingNew } = useNewArrivals(8);
  const { data: bestsellers, isLoading: loadingBest } = useBestsellers(8);
  const { data: trending, isLoading: loadingTrending } = useTrendingProducts(8);
  const { data: preorders, isLoading: loadingPreorder } = usePreorderProducts(4);

  const [config, setConfig] = useState<HomepageConfig | null>(null);

  useEffect(() => {
    fetch("/api/settings?key=homepage_config")
      .then((r) => r.json())
      .then((data) => {
        if (data?.value) setConfig(data.value);
      })
      .catch(() => {});
  }, []);

  const sections = config?.sections || defaultSections;
  const trustBadges = config?.trust_badges;
  const visibleSections = sections.filter((s) => s.visible).sort((a, b) => a.order - b.order);

  const getSection = (type: string) => visibleSections.find((s) => s.type === type);

  const renderSection = (section: SectionConfig) => {
    switch (section.type) {
      case "hero":
        return <HeroSection key={section.id} />;
      case "categories":
        return <CategoryShowcase key={section.id} />;
      case "new_arrivals":
        return (
          <ProductSection
            key={section.id}
            title={section.title || "New Arrivals"}
            subtitle={section.subtitle || "The latest additions to our collection"}
            products={newArrivals}
            isLoading={loadingNew}
            viewAllHref="/collections/new-arrivals"
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
              columns={4}
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
      case "faq":
        return <FaqSection key={section.id} />;
      default:
        return null;
    }
  };

  return <>{visibleSections.map(renderSection)}</>;
}
