import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import type { Product } from "@/types/product";

interface ProductRow extends RowDataPacket { [key: string]: unknown; }
interface ImageRow extends RowDataPacket { id: string; product_id: string; url: string; alt: string; order: number; }
interface VariantRow extends RowDataPacket {
  id: string; product_id: string; name: string; type: string; value: string; hex: string | null;
  price_adjustment: number; cost_price_adjustment: number; stock: number; sku: string;
  image: string | null; focal_point: string | null;
}

/**
 * Shared row-shaping for a single product, by slug or id — used by both the
 * public /api/products/[id] route and the product detail page's server-side
 * prefetch, so the two can never drift out of shape from each other.
 * cost_price is stripped: this is the public+admin-storefront shared shape,
 * never the admin-only one that includes margin data.
 */
export async function getProductBySlugOrId(slugOrId: string): Promise<Product | null> {
  const products = await query<ProductRow[]>(
    "SELECT * FROM products WHERE slug = ? OR id = ? LIMIT 1",
    [slugOrId, slugOrId]
  );
  if (products.length === 0) return null;

  const product = products[0];
  const [images, variants] = await Promise.all([
    query<ImageRow[]>("SELECT * FROM product_images WHERE product_id = ? ORDER BY `order`", [product.id as string]),
    query<VariantRow[]>("SELECT * FROM product_variants WHERE product_id = ?", [product.id as string]),
  ]);

  const { cost_price: _costPrice, ...publicProduct } = product;
  void _costPrice;

  return {
    ...publicProduct,
    price: Number(product.price),
    compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : undefined,
    is_active: !!product.is_active,
    is_featured: !!product.is_featured,
    average_rating: Number(product.average_rating),
    tags: typeof product.tags === "string" ? JSON.parse(product.tags || "[]") : product.tags || [],
    badges: typeof product.badges === "string" ? JSON.parse(product.badges || "[]") : product.badges || [],
    trust_badges: typeof product.trust_badges === "string" ? JSON.parse(product.trust_badges || "[]") : product.trust_badges || [],
    images: images.map((i) => ({ id: i.id, url: i.url, alt: i.alt || "", order: i.order })),
    variants: variants.map((v) => ({
      id: v.id, name: v.name, type: v.type as Product["variants"][number]["type"], value: v.value,
      hex: v.hex || undefined, price_adjustment: Number(v.price_adjustment), stock: v.stock, sku: v.sku,
      image: v.image || undefined, focal_point: v.focal_point || undefined,
    })),
  } as Product;
}
