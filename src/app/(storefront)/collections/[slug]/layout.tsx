import type { Metadata } from "next";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getProductsList } from "@/lib/products";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// Mirrors the buildUrl() params each service method
// (getNewArrivals/getBestsellers/getTrending) sends, so the prefetched cache
// entry lines up with whichever of useNewArrivals/useBestsellers/
// useTrendingProducts CollectionPage calls for this slug (queryKey:
// ["products", "<slug>", 24] — the page always requests limit 24).
const COLLECTION_FETCH: Record<string, () => Promise<import("@/types/product").Product[]>> = {
  "new-arrivals": async () => (await getProductsList(new URLSearchParams({ badges: "new", sort_by: "newest", limit: "24" }))).data,
  bestsellers: async () => (await getProductsList(new URLSearchParams({ badges: "bestseller", limit: "24" }))).data,
  trending: async () => (await getProductsList(new URLSearchParams({ badges: "trending", limit: "24" }))).data,
};

const COLLECTION_META: Record<string, { title: string; description: string }> = {
  "new-arrivals": {
    title: "New Arrivals — Latest Beauty & Lifestyle Products",
    description: "The latest additions to the ChineXa collection — be the first to discover fresh Korean skincare, bags, jewelry and beauty finds in Bangladesh.",
  },
  bestsellers: {
    title: "Best Sellers — Most Loved Beauty Products",
    description: "ChineXa's most loved products — tried, tested, and adored. Shop the bestselling skincare, bags, perfumes and jewelry in Bangladesh.",
  },
  trending: {
    title: "Trending Now — Hottest Beauty Products",
    description: "What everyone is talking about — the hottest beauty and lifestyle products of the season, available in Bangladesh with cash on delivery.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = COLLECTION_META[slug];
  if (!meta) {
    // Unknown collection slugs must not be indexed (thin/empty pages)
    return { title: "Collection Not Found", robots: { index: false, follow: true } };
  }
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `${siteUrl}/collections/${slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${siteUrl}/collections/${slug}`,
      type: "website",
    },
  };
}

export default async function CollectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fetchFn = COLLECTION_FETCH[slug];

  if (!fetchFn) {
    return children;
  }

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["products", slug, 24],
    queryFn: fetchFn,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
