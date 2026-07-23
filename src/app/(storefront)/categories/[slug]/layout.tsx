import type { Metadata } from "next";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getProductsList } from "@/lib/products";
import { pageMetadata, getSchemaConfig } from "@/lib/seo";
import { ItemListJsonLd } from "@/components/seo/json-ld";
import type { Product } from "@/types/product";
import type { PaginatedResponse } from "@/types/api";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT name, description, image, seo_title, seo_description FROM categories WHERE (slug = ? OR id = ?) AND is_active = 1 LIMIT 1",
      [slug, slug]
    );
    if (rows.length === 0) {
      return { title: "Category Not Found", robots: { index: false, follow: true } };
    }
    const cat = rows[0];
    const title = (cat.seo_title as string) || `${cat.name} — Shop Online in Bangladesh`;
    const description =
      (cat.seo_description as string) ||
      (cat.description as string) ||
      `Shop authentic ${cat.name} products at the best prices in Bangladesh. Genuine products with cash on delivery and fast shipping.`;
    const image = (cat.image as string) || `${siteUrl}/logo.png`;
    const fullImage = image.startsWith("http") ? image : `${siteUrl}${image}`;

    // Admin overrides (SEO Management → Page Meta) for this exact category URL
    // win over the category's own computed metadata.
    return pageMetadata(`/categories/${slug}`, {
      title,
      description: description.slice(0, 160),
      // Canonical is the clean category URL — ?sub= filter variations all point here.
      // en-BD hreflang pins this page to the Bangladesh market consistently
      // (previously only brand pages sent that signal).
      alternates: { canonical: `${siteUrl}/categories/${slug}`, languages: { "en-BD": `${siteUrl}/categories/${slug}` } },
      openGraph: {
        title,
        description: description.slice(0, 160),
        url: `${siteUrl}/categories/${slug}`,
        type: "website",
        images: [{ url: fullImage, width: 800, height: 600, alt: cat.name as string }],
      },
    });
  } catch {
    return { title: "Category" };
  }
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Server-side prefetch, same pattern as the product detail page: the page
  // below is a client component that reads the exact same React Query key
  // via useProducts() with these same default params on first render. Without
  // this, the initial HTML has no product grid at all — just a loading
  // skeleton — which is exactly the gap that made Google never see a price
  // on product pages before that was fixed; category pages had the same gap
  // for their product listings.
  const queryClient = new QueryClient();
  const initialParams = { page: 1, page_size: 12, sort_by: "featured" as const, category: slug };
  await queryClient.prefetchQuery({
    queryKey: ["products", initialParams],
    queryFn: () => getProductsList(new URLSearchParams({
      page: "1", page_size: "12", sort_by: "featured", category: slug,
    })),
  });

  // ItemList structured data — reuses the exact product list just prefetched
  // above (no extra query), so Google gets a structured product-list signal
  // for this category page. Admin-toggleable (SEO Management → Schema).
  const schema = await getSchemaConfig();
  const prefetched = queryClient.getQueryData<PaginatedResponse<Product> & { data: Product[] }>(["products", initialParams]);
  const listItems = (prefetched?.data || [])
    .filter((p) => p.slug)
    .map((p) => ({ name: p.name, url: `/products/${p.slug}` }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {schema.item_list && listItems.length > 0 && <ItemListJsonLd items={listItems} listName={slug} />}
      {children}
    </HydrationBoundary>
  );
}
