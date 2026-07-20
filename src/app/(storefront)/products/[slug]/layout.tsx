import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { getProductBySlugOrId } from "@/lib/products";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

interface LayoutProductRow extends RowDataPacket {
  id: string; name: string; short_description: string | null; description: string | null;
  price: number; compare_at_price: number | null; category_name: string | null; average_rating: number; review_count: number;
  sku: string; stock_quantity: number;
}

// React's cache() dedupes this across generateMetadata + the layout body
// within the same request — previously each ran its own independent set of
// raw pool.execute() calls (5 total per page load: product+image in
// generateMetadata, then product+image+variants again in the layout), which
// meant every single product page load did roughly double the DB round-trips
// of any other route in the app, all through the pool directly instead of
// the shared query() helper the rest of the app uses.
const getProductForLayout = cache(async (slug: string) => {
  const products = await query<LayoutProductRow[]>(
    "SELECT id, name, short_description, description, price, compare_at_price, category_name, average_rating, review_count, sku, stock_quantity FROM products WHERE slug = ? AND is_active = 1 LIMIT 1",
    [slug]
  );
  if (products.length === 0) return null;
  const product = products[0];

  const [images, variants] = await Promise.all([
    query<RowDataPacket[]>("SELECT url FROM product_images WHERE product_id = ? ORDER BY `order` LIMIT 1", [product.id]),
    // Same unordered row order the client's product.variants[0] uses for its
    // default/first swatch — kept consistent so the JSON-LD's price matches
    // what a shopper actually sees on first paint, before picking a variant.
    query<RowDataPacket[]>("SELECT price_adjustment FROM product_variants WHERE product_id = ?", [product.id]),
  ]);

  return { product, imageUrl: images[0]?.url as string | undefined, variants };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  try {
    const data = await getProductForLayout(slug);
    if (!data) return { title: "Product Not Found" };

    const { product, imageUrl } = data;
    const title = `${product.name} — Buy Online in Bangladesh`;
    const description = (product.short_description || product.description || "").slice(0, 160) ||
      `Buy ${product.name} at the best price in Bangladesh. Genuine product with cash on delivery.`;

    const fullImageUrl = imageUrl
      ? (imageUrl.startsWith("http") ? imageUrl : `${siteUrl}${imageUrl}`)
      : `${siteUrl}/logo.png`;

    return {
      title,
      description,
      alternates: { canonical: `${siteUrl}/products/${slug}` },
      openGraph: {
        title,
        description,
        url: `${siteUrl}/products/${slug}`,
        type: "website",
        images: [{ url: fullImageUrl, width: 800, height: 800, alt: product.name }],
      },
      twitter: {
        card: "summary_large_image",
        title: product.name,
        description,
        images: [fullImageUrl],
      },
    };
  } catch {
    return { title: "Product" };
  }
}

// Isolated in its own async component (not inlined in the layout body) so it
// can sit behind a local <Suspense> boundary. JSON-LD is invisible markup for
// search engines/crawlers — it must never block the visible, interactive
// page from rendering, and on a client-side navigation (Link click), only
// this route segment re-renders below the shared storefront layout with no
// boundary of its own to fall back on — so an unwrapped DB call here would
// hold up the *entire* navigation, not just the structured-data markup.
async function ProductStructuredData({ slug }: { slug: string }) {
  let productData = null;
  try {
    const data = await getProductForLayout(slug);
    if (data) {
      const { product, imageUrl, variants } = data;
      const basePrice = Number(product.price);
      // The storefront shows no variant pre-selected on first paint (product
      // page starts with selectedVariant = null), so the price a shopper —
      // and Google's crawler — actually sees first is the first-listed
      // variant's adjusted price, not the bare base price ignoring variants.
      const initialPrice = variants.length > 0 ? basePrice + Number(variants[0].price_adjustment) : basePrice;
      const compareAtPrice = product.compare_at_price
        ? Number(product.compare_at_price) + (variants.length > 0 ? Number(variants[0].price_adjustment) : 0)
        : undefined;

      let highPrice: number | undefined;
      if (variants.length > 1) {
        const prices = variants.map((v) => basePrice + Number(v.price_adjustment));
        const maxP = Math.max(...prices);
        if (maxP > initialPrice) highPrice = maxP;
      }

      productData = {
        name: product.name,
        description: (product.short_description || product.description || "").slice(0, 300),
        image: imageUrl || "/logo.png",
        sku: product.sku,
        price: initialPrice,
        compareAtPrice: highPrice ? undefined : compareAtPrice,
        highPrice,
        availability: (Number(product.stock_quantity) > 0 ? "InStock" : "OutOfStock") as "InStock" | "OutOfStock",
        rating: Number(product.average_rating) || undefined,
        reviewCount: Number(product.review_count) || undefined,
        category: product.category_name || undefined,
        url: `/products/${slug}`,
      };
    }
  } catch {}

  if (!productData) return null;

  return (
    <>
      <ProductJsonLd {...productData} />
      <BreadcrumbJsonLd items={[
        { name: "Home", url: "/" },
        { name: "Products", url: "/products" },
        ...(productData.category ? [{ name: productData.category, url: `/products?category=${encodeURIComponent(productData.category)}` }] : []),
        { name: productData.name, url: `/products/${slug}` },
      ]} />
    </>
  );
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Server-side prefetch so the price/name/images are present in the
  // initial HTML response — the page below is a client component that reads
  // this same query key via useProduct(). Without this, a crawler (or a
  // user with slow JS) sees only the loading skeleton on first paint, which
  // is why Google was never picking up a price for these pages: the
  // JSON-LD said one thing, but the rendered page had no price at all until
  // client-side JS fetched it.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["product", slug],
    queryFn: () => getProductBySlugOrId(slug),
  });

  return (
    <>
      <Suspense fallback={null}>
        <ProductStructuredData slug={slug} />
      </Suspense>
      <HydrationBoundary state={dehydrate(queryClient)}>
        {children}
      </HydrationBoundary>
    </>
  );
}
