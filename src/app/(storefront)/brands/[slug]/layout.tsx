import type { Metadata } from "next";
import { cache } from "react";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BrandJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { getBrandBySlug } from "@/lib/brands";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

interface SeoRow extends RowDataPacket { seo_title: string | null; seo_description: string | null; country: string | null; }

// React's cache() dedupes the brand lookup across generateMetadata + the
// layout body within the same request, same reasoning as
// products/[slug]/layout.tsx's getProductForLayout — this used to be 3
// separate `brands` table lookups per page load (metadata, JSON-LD, and now
// prefetch); getBrandBySlug covers JSON-LD + prefetch, and this local query
// only pulls the couple of SEO-only fields getBrandBySlug doesn't select.
const getSeoFields = cache(async (slug: string): Promise<SeoRow | null> => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT seo_title, seo_description, country FROM brands WHERE (slug = ? OR id = ?) AND is_active = 1 LIMIT 1",
    [slug, slug]
  );
  return rows.length > 0 ? (rows[0] as SeoRow) : null;
});
const getBrandForLayout = cache(getBrandBySlug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [brand, seo] = await Promise.all([getBrandForLayout(slug), getSeoFields(slug)]);
    if (!brand) {
      return { title: "Brand Not Found", robots: { index: false, follow: true } };
    }
    const title = seo?.seo_title || `${brand.name} — Authentic Products in Bangladesh`;
    const description =
      seo?.seo_description ||
      brand.description ||
      `Shop authentic ${brand.name}${seo?.country ? ` (${seo.country})` : ""} products at ChineXa Bangladesh. Genuine products with cash on delivery.`;
    const logo = brand.logo || `${siteUrl}/logo.png`;
    const fullLogo = logo.startsWith("http") ? logo : `${siteUrl}${logo}`;
    const url = `${siteUrl}/brands/${slug}`;

    return {
      title,
      description: description.slice(0, 160),
      // en-BD tells Google this page specifically targets Bangladesh — a
      // second country buying the same brand internationally should not see
      // this page ranked ahead of their own local sources.
      alternates: { canonical: url, languages: { "en-BD": url } },
      openGraph: {
        title,
        description: description.slice(0, 160),
        url,
        type: "website",
        images: [{ url: fullLogo, width: 400, height: 400, alt: brand.name }],
        // Open Graph doesn't have a dedicated country field, but declaring the
        // locale as en_BD (vs. plain en_US) is one more Bangladesh signal
        // picked up by crawlers/social previews that read og:locale.
        locale: "en_BD",
      },
      // geo.* meta tags are a long-standing (non-schema.org) convention search
      // engines still read for local/regional intent — pins this specific
      // page to Bangladesh/Dhaka, same values already used in the site-wide
      // OrganizationJsonLd (see src/components/seo/json-ld.tsx).
      other: {
        "geo.region": "BD",
        "geo.placename": "Dhaka",
        "ICBM": "23.8103, 90.4125",
      },
    };
  } catch {
    return { title: "Brand" };
  }
}

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // getBrandForLayout can throw on a genuine DB outage (not just "no rows",
  // which it already handles by returning null) — must stay non-fatal here
  // since a DB hiccup shouldn't 500 the whole page when the client-side
  // useBrand(slug) fetch would have just as easily failed and rendered the
  // page's own "Brand Not Found" state instead.
  const brand = await getBrandForLayout(slug).catch(() => null);

  // Server-side prefetch, same pattern as the product/category detail pages:
  // BrandPage below reads this exact query key via useBrand(slug). Without
  // this, the page's brand header (name/logo/description) rendered as a bare
  // Skeleton with nothing in the initial HTML until the client re-fetched
  // the same row this layout already looked up.
  const queryClient = new QueryClient();
  queryClient.setQueryData(["brand", slug], brand);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {brand && (
        <>
          <BrandJsonLd
            name={brand.name}
            description={brand.description || `${brand.name} products, authentic and shipped within Bangladesh.`}
            logo={brand.logo}
            url={`/brands/${slug}`}
            sameAs={brand.website ? [brand.website] : undefined}
          />
          <BreadcrumbJsonLd items={[
            { name: "Home", url: "/" },
            { name: "Brands", url: "/brands" },
            { name: brand.name, url: `/brands/${slug}` },
          ]} />
        </>
      )}
      {children}
    </HydrationBoundary>
  );
}
