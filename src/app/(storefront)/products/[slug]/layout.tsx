import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { getProductBySlugOrId } from "@/lib/products";
import { pageMetadata, getSchemaConfig } from "@/lib/seo";
import { productSeoTitle, productSeoDescription, productSeoKeywords } from "@/lib/seo-templates";
import { isPreorderable } from "@/lib/preorder";
import { preordersEnabled } from "@/lib/migrate-preorder";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

interface LayoutProductRow extends RowDataPacket {
  id: string; name: string; short_description: string | null; description: string | null;
  price: number; compare_at_price: number | null; category_name: string | null; average_rating: number; review_count: number;
  sku: string; stock_quantity: number; badges: unknown; preorder_release_date: string | null;
  brand_name: string | null; seo_title: string | null; seo_description: string | null;
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
    "SELECT id, name, short_description, description, price, compare_at_price, category_name, average_rating, review_count, sku, stock_quantity, badges, preorder_release_date, brand_name, seo_title, seo_description FROM products WHERE slug = ? AND is_active = 1 LIMIT 1",
    [slug]
  );
  if (products.length === 0) return null;
  const product = products[0];

  const [images, variants, reviews] = await Promise.all([
    query<RowDataPacket[]>("SELECT url FROM product_images WHERE product_id = ? ORDER BY `order` LIMIT 1", [product.id]),
    // Same unordered row order the client's product.variants[0] uses for its
    // default/first swatch — kept consistent so the JSON-LD's price matches
    // what a shopper actually sees on first paint, before picking a variant.
    query<RowDataPacket[]>("SELECT price_adjustment FROM product_variants WHERE product_id = ?", [product.id]),
    // A few real, APPROVED reviews for the Product JSON-LD's review array —
    // approved-only so nothing unmoderated is surfaced to Google.
    query<RowDataPacket[]>(
      "SELECT customer_name, rating, title, comment, created_at FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 5",
      [product.id]
    ).catch(() => [] as RowDataPacket[]),
  ]);

  return { product, imageUrl: images[0]?.url as string | undefined, variants, reviews };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  try {
    const data = await getProductForLayout(slug);
    if (!data) return { title: "Product Not Found" };

    const { product, imageUrl } = data;
    // Automated evergreen BD-intent templates ("price in Bangladesh",
    // original/authentic, COD, live ৳price) — the product's own admin-entered
    // seo_title/seo_description win when set (these columns were previously
    // never read here), and Page-Meta overrides win on top of everything.
    const title = product.seo_title || productSeoTitle(product.name, product.brand_name);
    const description = product.seo_description || productSeoDescription(product.name, Number(product.price), {
      brandName: product.brand_name,
      categoryName: product.category_name,
      shortDescription: product.short_description || product.description,
    });

    const fullImageUrl = imageUrl
      ? (imageUrl.startsWith("http") ? imageUrl : `${siteUrl}${imageUrl}`)
      : `${siteUrl}/logo.png`;

    // Admin overrides (SEO Management → Page Meta) for this exact product URL
    // win over the product's own computed metadata.
    return pageMetadata(`/products/${slug}`, {
      title,
      description,
      keywords: productSeoKeywords(product.name, product.brand_name, product.category_name),
      // en-BD hreflang pins product pages to the Bangladesh market (matches
      // the signal brand pages already send).
      alternates: { canonical: `${siteUrl}/products/${slug}`, languages: { "en-BD": `${siteUrl}/products/${slug}` } },
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
    });
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
      const { product, imageUrl, variants, reviews } = data;
      const basePrice = Number(product.price);
      // Pre-order signal for Google: out of stock + `preorder` badge + feature
      // on → availability PreOrder (with availabilityStarts if a date is set).
      const preorderable = isPreorderable(
        { stock_quantity: Number(product.stock_quantity), badges: product.badges as string },
        Number(product.stock_quantity),
        await preordersEnabled()
      );
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
        availability: (Number(product.stock_quantity) > 0 ? "InStock" : preorderable ? "PreOrder" : "OutOfStock") as "InStock" | "OutOfStock" | "PreOrder",
        availabilityStarts: preorderable && product.preorder_release_date ? String(product.preorder_release_date).slice(0, 10) : undefined,
        rating: Number(product.average_rating) || undefined,
        reviewCount: Number(product.review_count) || undefined,
        reviews: reviews.map((r) => ({
          author: (r.customer_name as string) || "Customer",
          rating: Number(r.rating),
          title: (r.title as string) || undefined,
          body: (r.comment as string) || undefined,
          date: r.created_at ? new Date(r.created_at as string).toISOString() : undefined,
        })),
        category: product.category_name || undefined,
        url: `/products/${slug}`,
      };
    }
  } catch {}

  if (!productData) return null;

  // Admin-controlled structured-data toggles (SEO Management → Schema):
  // product rich results, star ratings, and breadcrumbs can each be disabled.
  const schema = await getSchemaConfig();
  if (!schema.review) {
    productData = { ...productData, rating: undefined, reviewCount: undefined, reviews: [] };
  }

  return (
    <>
      {schema.product && <ProductJsonLd {...productData} />}
      {schema.breadcrumb && (
        <BreadcrumbJsonLd items={[
          { name: "Home", url: "/" },
          { name: "Products", url: "/products" },
          ...(productData.category ? [{ name: productData.category, url: `/products?category=${encodeURIComponent(productData.category)}` }] : []),
          { name: productData.name, url: `/products/${slug}` },
        ]} />
      )}
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
