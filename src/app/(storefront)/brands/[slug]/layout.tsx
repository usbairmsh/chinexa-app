import type { Metadata } from "next";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT name, description, logo, country FROM brands WHERE (slug = ? OR id = ?) AND is_active = 1 LIMIT 1",
      [slug, slug]
    );
    if (rows.length === 0) {
      return { title: "Brand Not Found", robots: { index: false, follow: true } };
    }
    const brand = rows[0];
    const title = `${brand.name} — Authentic Products in Bangladesh`;
    const description =
      ((brand.description as string) || "").slice(0, 160) ||
      `Shop authentic ${brand.name}${brand.country ? ` (${brand.country})` : ""} products at ChineXa Bangladesh. Genuine products with cash on delivery.`;
    const logo = (brand.logo as string) || `${siteUrl}/logo.png`;
    const fullLogo = logo.startsWith("http") ? logo : `${siteUrl}${logo}`;

    return {
      title,
      description,
      alternates: { canonical: `${siteUrl}/brands/${slug}` },
      openGraph: {
        title,
        description,
        url: `${siteUrl}/brands/${slug}`,
        type: "website",
        images: [{ url: fullLogo, width: 400, height: 400, alt: brand.name as string }],
      },
    };
  } catch {
    return { title: "Brand" };
  }
}

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
