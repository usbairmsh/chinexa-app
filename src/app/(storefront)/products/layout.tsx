import type { Metadata } from "next";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getProductsList } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

const defaultMetadata: Metadata = {
  title: "Shop All Products — Premium Beauty & Lifestyle",
  description: "Browse our complete collection of authentic Korean skincare, luxury bags, exquisite jewelry, fine perfumes & imported beauty products. Free delivery on orders over ৳3,000.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Shop All Products — ChineXa",
    description: "Browse authentic Korean skincare, luxury bags, jewelry, perfumes & imported beauty products.",
  },
};

// Admin overrides (SEO Management → Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/products", defaultMetadata);
}

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  // Server-side prefetch, same pattern as categories/[slug]/layout.tsx: the
  // page below is a client component whose first render calls useProducts()
  // with this exact default params object, so the query key below must stay
  // in sync with ProductsPage's initial useState value.
  const queryClient = new QueryClient();
  const initialParams = { page: 1, page_size: 12, sort_by: "featured" as const };
  await queryClient.prefetchQuery({
    queryKey: ["products", initialParams],
    queryFn: () => getProductsList(new URLSearchParams({
      page: "1", page_size: "12", sort_by: "featured",
    })),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
