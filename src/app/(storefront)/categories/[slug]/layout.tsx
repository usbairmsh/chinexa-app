import type { Metadata } from "next";
import { cache } from "react";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getProductsList } from "@/lib/products";
import { pageMetadata, getSchemaConfig } from "@/lib/seo";
import { getCategorySeoStats, categorySeoTitle, categorySeoDescription, categorySeoKeywords, getCategorySynonyms } from "@/lib/seo-templates";
import { ItemListJsonLd } from "@/components/seo/json-ld";
import type { Product } from "@/types/product";
import type { PaginatedResponse } from "@/types/api";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// Shared, per-request-cached category lookup — used by generateMetadata AND the
// layout body (landing copy), so the row is fetched once.
const getCategoryForLayout = cache(async (slug: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, name, parent_id, description, image, seo_title, seo_description FROM categories WHERE (slug = ? OR id = ?) AND is_active = 1 LIMIT 1",
    [slug, slug]
  );
  return rows.length > 0 ? rows[0] : null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const cat = await getCategoryForLayout(slug);
    if (!cat) {
      return { title: "Category Not Found", robots: { index: false, follow: true } };
    }
    // Automated, evergreen BD-intent templates ("price in Bangladesh",
    // original/authentic, COD) with live min-price/product-count — used only as
    // the FALLBACK: the category's own seo_title/seo_description always win,
    // and admin Page-Meta overrides win on top of everything.
    const stats = await getCategorySeoStats(String(cat.id), String(cat.name), cat.parent_id != null);
    const title = (cat.seo_title as string) || categorySeoTitle(cat.name as string);
    const description =
      (cat.seo_description as string) ||
      categorySeoDescription(cat.name as string, stats) ||
      (cat.description as string);
    const image = (cat.image as string) || `${siteUrl}/logo.png`;
    const fullImage = image.startsWith("http") ? image : `${siteUrl}${image}`;

    // Admin overrides (SEO Management → Page Meta) for this exact category URL
    // win over the category's own computed metadata.
    return pageMetadata(`/categories/${slug}`, {
      title,
      description: description.slice(0, 160),
      keywords: categorySeoKeywords(cat.name as string),
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

  // Auto-composed, crawlable landing copy — rendered BELOW the listing (the
  // standard e-commerce SEO-text placement, so the page design is untouched).
  // Built from live data; only renders when the category actually has products.
  let seoCopy: { name: string; count: number; minPrice: number | null; brands: string[]; synonym?: string } | null = null;
  try {
    const cat = await getCategoryForLayout(slug);
    if (cat) {
      const stats = await getCategorySeoStats(String(cat.id), String(cat.name), cat.parent_id != null);
      if (stats.count > 0) {
        seoCopy = { name: String(cat.name), ...stats, synonym: getCategorySynonyms(String(cat.name))[0] };
      }
    }
  } catch { seoCopy = null; }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {schema.item_list && listItems.length > 0 && <ItemListJsonLd items={listItems} listName={slug} />}
      {children}
      {seoCopy && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
          <div className="border-t border-border/30 pt-8 max-w-3xl">
            <h2 className="font-heading text-lg font-semibold text-charcoal mb-2">
              Buy Original {seoCopy.name} in Bangladesh
            </h2>
            <p className="text-sm text-charcoal-lighter leading-relaxed">
              Looking for 100% original {seoCopy.name.toLowerCase()}
              {seoCopy.synonym ? ` (${seoCopy.synonym})` : ""} at the best price in Bangladesh? ChineXa brings you{" "}
              {seoCopy.count}+ authentic products
              {seoCopy.minPrice != null && seoCopy.minPrice > 0 ? ` starting from ৳${Math.round(seoCopy.minPrice).toLocaleString("en-BD")}` : ""}
              {seoCopy.brands.length > 0 ? `, featuring ${seoCopy.brands.join(", ")}` : ""}. Every item is sourced
              from authorised suppliers — no replicas, ever. Enjoy cash on delivery anywhere in Bangladesh, fast
              delivery in Dhaka, and a 7-day easy return policy on every order.
            </p>
          </div>
        </section>
      )}
    </HydrationBoundary>
  );
}
