"use client";

import { useEffect, useState } from "react";
import { ProductSection } from "@/components/storefront/home/product-section";
import { useRecentlyViewedStore } from "@/stores/recently-viewed.store";
import type { Product } from "@/types/product";

// Self-contained "Recently Viewed" strip. Reads the client-only history store,
// re-fetches current product data (so price/stock/badges are fresh and deleted
// products drop out), and renders a marquee strip. Renders nothing until
// mounted and when there's nothing to show — so it never causes a hydration
// mismatch or an empty heading.
//
// `excludeId` lets the PDP hide the product currently being viewed from its own
// "recently viewed" strip.
export function RecentlyViewedSection({ excludeId }: { excludeId?: string } = {}) {
  const items = useRecentlyViewedStore((s) => s.items);
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const ids = items.filter((id) => id !== excludeId);
    if (ids.length === 0) { setProducts([]); return; }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/products?ids=${ids.map(encodeURIComponent).join(",")}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .catch(() => ({ data: [] }))
      .then((res) => {
        if (cancelled) return;
        const data: Product[] = Array.isArray(res.data) ? res.data : [];
        // Preserve the most-recent-first order from the store (the API returns
        // them in arbitrary order).
        const byId = new Map(data.map((p) => [p.id, p]));
        setProducts(ids.map((id) => byId.get(id)).filter((p): p is Product => !!p));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mounted, items, excludeId]);

  // Nothing to show (pre-mount, empty history, or all filtered/deleted) → render
  // nothing rather than an empty section.
  if (!mounted) return null;
  if (!loading && products.length === 0) return null;

  return (
    <ProductSection
      title="Recently Viewed"
      subtitle="Pick up where you left off"
      products={products}
      isLoading={loading && products.length === 0}
      scroll={products.length > 4}
    />
  );
}
