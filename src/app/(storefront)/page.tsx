import type { Metadata } from "next";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { HomeClient } from "@/components/storefront/home/home-client";
import { pageMetadata } from "@/lib/seo";

// Admin-entered overrides for "/" (SEO Management → Page Meta) apply on top
// of the site-wide defaults the root layout already provides.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/");
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

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["banners", "hero"],
      queryFn: async () => {
        const res = await fetch(`${internalUrl}/api/banners?position=hero`, { cache: "no-store" });
        if (!res.ok) return [];
        return res.json();
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["categories"],
      queryFn: async () => {
        const res = await fetch(`${internalUrl}/api/categories`, { cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeClient />
    </HydrationBoundary>
  );
}
