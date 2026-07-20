import type { Metadata } from "next";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { BrandJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT name, description, logo, country, seo_title, seo_description FROM brands WHERE (slug = ? OR id = ?) AND is_active = 1 LIMIT 1",
      [slug, slug]
    );
    if (rows.length === 0) {
      return { title: "Brand Not Found", robots: { index: false, follow: true } };
    }
    const brand = rows[0];
    const title = (brand.seo_title as string) || `${brand.name} — Authentic Products in Bangladesh`;
    const description =
      (brand.seo_description as string) ||
      (brand.description as string) ||
      `Shop authentic ${brand.name}${brand.country ? ` (${brand.country})` : ""} products at ChineXa Bangladesh. Genuine products with cash on delivery.`;
    const logo = (brand.logo as string) || `${siteUrl}/logo.png`;
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
        images: [{ url: fullLogo, width: 400, height: 400, alt: brand.name as string }],
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

  let jsonLdData: { name: string; description: string; logo?: string; website?: string } | null = null;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT name, description, logo, website FROM brands WHERE (slug = ? OR id = ?) AND is_active = 1 LIMIT 1",
      [slug, slug]
    );
    if (rows.length > 0) {
      const b = rows[0];
      jsonLdData = {
        name: b.name as string,
        description: (b.description as string) || `${b.name} products, authentic and shipped within Bangladesh.`,
        logo: (b.logo as string) || undefined,
        website: (b.website as string) || undefined,
      };
    }
  } catch {}

  return (
    <>
      {jsonLdData && (
        <>
          <BrandJsonLd
            name={jsonLdData.name}
            description={jsonLdData.description}
            logo={jsonLdData.logo}
            url={`/brands/${slug}`}
            sameAs={jsonLdData.website ? [jsonLdData.website] : undefined}
          />
          <BreadcrumbJsonLd items={[
            { name: "Home", url: "/" },
            { name: "Brands", url: "/brands" },
            { name: jsonLdData.name, url: `/brands/${slug}` },
          ]} />
        </>
      )}
      {children}
    </>
  );
}
