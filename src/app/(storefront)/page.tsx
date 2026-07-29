import type { Metadata } from "next";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { HomeClient } from "@/components/storefront/home/home-client";
import { pageMetadata } from "@/lib/seo";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// Admin-entered overrides for "/" (SEO Management → Page Meta) apply on top
// of the site-wide defaults the root layout already provides.
export async function generateMetadata(): Promise<Metadata> {
  const meta = await pageMetadata("/", {
    // Homepage canonical — the root layout intentionally omits a site-wide
    // canonical, so set the homepage's own here.
    alternates: { canonical: siteUrl, languages: { "en-BD": siteUrl } },
  });
  // The homepage title already contains "ChineXa"; wrap it as `absolute` so the
  // root layout's "%s | ChineXa" template doesn't append a second "| ChineXa"
  // (a plain string title from an admin "/" override otherwise gets doubled).
  if (typeof meta.title === "string") {
    meta.title = { absolute: meta.title };
  }
  return meta;
}

// Loopback, not the public domain — fetching the public domain from inside
// the container can fail (hairpin NAT), same reasoning as sitemap.ts.
const internalUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;

// Server-side prefetch for the two above-the-fold sections only (hero banner,
// category grid) — these are what the homepage's first Lighthouse run showed
// as the actual LCP candidates, both client-fetched with nothing in the
// initial HTML for the browser to preload. Below-the-fold sections (new
// arrivals, bestsellers, etc.) are intentionally left as pure client fetches;
// prefetching those too would only delay this response for content that
// isn't on the critical rendering path. Query keys below must stay in sync
// with useBanners("hero") (queryKey: ["banners", "hero"]) and useCategories()
// (queryKey: ["categories"]) — if either hook's key changes, update here too.
export default async function HomePage() {
  const queryClient = new QueryClient();

  // Server-prefetch the above-the-fold sections so their data ships in the
  // initial HTML and renders on first paint — instead of the browser booting
  // React, THEN firing these fetches, THEN waiting (which is why the product
  // rows lagged behind the categories). Cached 60s (banners/categories/product
  // rows change rarely) to also cut per-request DB work.
  //
  // The product query keys + the returned (unwrapped) array must match what the
  // hooks in use-products.ts expect, so the client reuses this cache instead of
  // refetching. limit=8 is the default (rows 2 × cols 4).
  const products = (q: string) => async () => {
    const res = await fetch(`${internalUrl}/api/products?${q}&limit=8`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  };

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["banners", "hero"],
      queryFn: async () => {
        const res = await fetch(`${internalUrl}/api/banners?position=hero`, { next: { revalidate: 60 } });
        if (!res.ok) return [];
        return res.json();
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["categories"],
      queryFn: async () => {
        const res = await fetch(`${internalUrl}/api/categories`, { next: { revalidate: 60 } });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
    }),
    // Product rows — keys/params mirror useNewArrivals/useBestsellers/useTrending.
    queryClient.prefetchQuery({ queryKey: ["products", "new-arrivals", 8], queryFn: products("badges=new&sort_by=newest") }),
    queryClient.prefetchQuery({ queryKey: ["products", "bestsellers", 8], queryFn: products("badges=bestseller") }),
    queryClient.prefetchQuery({ queryKey: ["products", "trending", 8], queryFn: products("badges=trending") }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeClient />
    </HydrationBoundary>
  );
}
