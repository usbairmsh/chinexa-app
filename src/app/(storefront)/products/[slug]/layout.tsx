import type { Metadata } from "next";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT name, short_description, description, price, category_name, average_rating, review_count, sku FROM products WHERE slug = ? AND is_active = 1 LIMIT 1",
      [slug]
    );

    if (rows.length === 0) {
      return { title: "Product Not Found" };
    }

    const product = rows[0];
    const title = `${product.name} — Buy Online in Bangladesh`;
    const description = (product.short_description || product.description || "").slice(0, 160) ||
      `Buy ${product.name} at the best price in Bangladesh. Genuine product with cash on delivery.`;

    // Get first product image
    const [images] = await pool.execute<RowDataPacket[]>(
      "SELECT url FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = ? LIMIT 1) ORDER BY `order` LIMIT 1",
      [slug]
    );
    const imageUrl = images.length > 0 ? (images[0].url as string) : `${siteUrl}/logo.png`;
    const fullImageUrl = imageUrl.startsWith("http") ? imageUrl : `${siteUrl}${imageUrl}`;

    return {
      title,
      description,
      alternates: { canonical: `${siteUrl}/products/${slug}` },
      openGraph: {
        title,
        description,
        url: `${siteUrl}/products/${slug}`,
        type: "website",
        images: [{ url: fullImageUrl, width: 800, height: 800, alt: product.name as string }],
      },
      twitter: {
        card: "summary_large_image",
        title: product.name as string,
        description,
        images: [fullImageUrl],
      },
    };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fetch product for JSON-LD
  let productData = null;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, short_description, description, price, category_name, average_rating, review_count, sku, stock_quantity FROM products WHERE slug = ? AND is_active = 1 LIMIT 1",
      [slug]
    );
    if (rows.length > 0) {
      const p = rows[0];
      const [images] = await pool.execute<RowDataPacket[]>(
        "SELECT url FROM product_images WHERE product_id = ? ORDER BY `order` LIMIT 1",
        [p.id]
      );
      // Get variant prices for price range
      const [variantRows] = await pool.execute<RowDataPacket[]>(
        "SELECT price_adjustment FROM product_variants WHERE product_id = ?", [p.id]
      );
      const basePrice = Number(p.price);
      let highPrice: number | undefined;
      if (variantRows.length > 1) {
        const prices = variantRows.map((v) => basePrice + Number(v.price_adjustment));
        const maxP = Math.max(...prices);
        if (maxP > basePrice) highPrice = maxP;
      }

      productData = {
        name: p.name as string,
        description: ((p.short_description || p.description || "") as string).slice(0, 300),
        image: images.length > 0 ? (images[0].url as string) : "/logo.png",
        sku: p.sku as string,
        price: basePrice,
        highPrice,
        availability: (Number(p.stock_quantity) > 0 ? "InStock" : "OutOfStock") as "InStock" | "OutOfStock",
        rating: Number(p.average_rating) || undefined,
        reviewCount: Number(p.review_count) || undefined,
        category: (p.category_name as string) || undefined,
        url: `/products/${slug}`,
      };
    }
  } catch {}

  return (
    <>
      {productData && (
        <>
          <ProductJsonLd {...productData} />
          <BreadcrumbJsonLd items={[
            { name: "Home", url: "/" },
            { name: "Products", url: "/products" },
            ...(productData.category ? [{ name: productData.category, url: `/products?category=${encodeURIComponent(productData.category)}` }] : []),
            { name: productData.name, url: `/products/${slug}` },
          ]} />
        </>
      )}
      {children}
    </>
  );
}
