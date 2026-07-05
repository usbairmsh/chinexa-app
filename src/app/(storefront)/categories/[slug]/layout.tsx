import type { Metadata } from "next";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

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

    return {
      title,
      description: description.slice(0, 160),
      // Canonical is the clean category URL — ?sub= filter variations all point here
      alternates: { canonical: `${siteUrl}/categories/${slug}` },
      openGraph: {
        title,
        description: description.slice(0, 160),
        url: `${siteUrl}/categories/${slug}`,
        type: "website",
        images: [{ url: fullImage, width: 800, height: 600, alt: cat.name as string }],
      },
    };
  } catch {
    return { title: "Category" };
  }
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
