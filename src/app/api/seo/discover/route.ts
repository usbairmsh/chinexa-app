import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// A discovered page + the default title/description its layout would compute
// on its own. The SEO screen shows these as the fallback and only stores an
// override when the admin actually edits + saves — so an untouched page keeps
// deriving its meta live, exactly as before.
interface DiscoveredPage {
  path: string;
  label: string;      // grouping label shown in the table ("Product", "Category", …)
  default_title: string;
  default_description: string;
}

// Mirrors the per-page defaults the layouts build in their generateMetadata,
// so what the admin sees pre-filled matches what actually ships when they
// don't override anything. Kept in sync with:
//   products/[slug]/layout.tsx, categories/[slug]/layout.tsx,
//   brands/[slug]/layout.tsx, blog/[slug]/layout.tsx, and the static layouts.
const STATIC_PAGES: DiscoveredPage[] = [
  { path: "/", label: "Core", default_title: "ChineXa — Premium Beauty, Skincare & Lifestyle Store in Bangladesh", default_description: "Shop authentic Korean skincare, luxury bags, exquisite jewelry, fine perfumes & imported beauty products in Bangladesh." },
  { path: "/products", label: "Core", default_title: "Shop All Products — Premium Beauty & Lifestyle", default_description: "Browse our complete collection of authentic Korean skincare, luxury bags, exquisite jewelry, fine perfumes & imported beauty products." },
  { path: "/about", label: "Core", default_title: "About ChineXa — Our Story & Mission", default_description: "Learn about ChineXa, Bangladesh's premium beauty & lifestyle destination." },
  { path: "/blog", label: "Core", default_title: "Beauty Blog — Tips, Guides & Trends", default_description: "Expert beauty tips, Korean skincare guides, product reviews & trending looks." },
  { path: "/brands", label: "Core", default_title: "Our Brands — Authentic International Beauty Brands", default_description: "Explore the authentic international brands available at ChineXa." },
  { path: "/faq", label: "Core", default_title: "FAQ — Frequently Asked Questions", default_description: "Find answers to common questions about orders, shipping, returns & payments at ChineXa." },
  { path: "/contact", label: "Core", default_title: "Contact Us — ChineXa Customer Support", default_description: "Get in touch with ChineXa. We're here to help with orders, products, returns & general inquiries." },
  { path: "/track-order", label: "Core", default_title: "Track Your Order", default_description: "Track your ChineXa order status in real time using your order number or phone number." },
  { path: "/collections/new-arrivals", label: "Collection", default_title: "New Arrivals — Latest Beauty & Lifestyle Products", default_description: "The latest additions to the ChineXa collection." },
  { path: "/collections/bestsellers", label: "Collection", default_title: "Best Sellers — Most Loved Beauty Products", default_description: "ChineXa's most loved products — tried, tested, and adored." },
  { path: "/collections/trending", label: "Collection", default_title: "Trending Now — Hottest Beauty Products", default_description: "What everyone is talking about — the hottest beauty and lifestyle products of the season." },
];

const clip = (s: string, n = 160) => (s || "").replace(/\s+/g, " ").trim().slice(0, n);

export async function GET(req: import("next/server").NextRequest) {
  // Same gate as the rest of SEO management.
  const denied = await requirePermission(req, "seo", "view");
  if (denied) return denied;

  try {
    const [products, categories, brands, blog] = await Promise.all([
      query<RowDataPacket[]>("SELECT slug, name, short_description, description FROM products WHERE is_active = 1 AND slug IS NOT NULL AND slug <> '' ORDER BY updated_at DESC"),
      query<RowDataPacket[]>("SELECT slug, name, description FROM categories WHERE is_active = 1 AND slug IS NOT NULL AND slug <> '' ORDER BY `order`").catch(() => [] as RowDataPacket[]),
      query<RowDataPacket[]>("SELECT slug, name, description FROM brands WHERE is_active = 1 AND slug IS NOT NULL AND slug <> '' ORDER BY name").catch(() => [] as RowDataPacket[]),
      query<RowDataPacket[]>("SELECT slug, title, excerpt FROM blog_posts WHERE is_published = 1 AND slug IS NOT NULL AND slug <> '' ORDER BY published_at DESC").catch(() => [] as RowDataPacket[]),
    ]);

    const pages: DiscoveredPage[] = [...STATIC_PAGES];

    for (const p of products) {
      const name = p.name as string;
      pages.push({
        path: `/products/${p.slug}`,
        label: "Product",
        default_title: `${name} — Buy Online in Bangladesh`,
        default_description: clip((p.short_description as string) || (p.description as string) || `Buy ${name} at the best price in Bangladesh. Genuine product with cash on delivery.`),
      });
    }
    for (const c of categories) {
      const name = c.name as string;
      pages.push({
        path: `/categories/${c.slug}`,
        label: "Category",
        default_title: `${name} — Shop Online in Bangladesh`,
        default_description: clip((c.description as string) || `Shop authentic ${name} products at the best prices in Bangladesh.`),
      });
    }
    for (const b of brands) {
      const name = b.name as string;
      pages.push({
        path: `/brands/${b.slug}`,
        label: "Brand",
        default_title: `${name} — Authentic Products in Bangladesh`,
        default_description: clip((b.description as string) || `Shop authentic ${name} products at ChineXa Bangladesh.`),
      });
    }
    for (const post of blog) {
      const title = post.title as string;
      pages.push({
        path: `/blog/${post.slug}`,
        label: "Blog",
        default_title: title,
        default_description: clip((post.excerpt as string) || `Read "${title}" on the ChineXa beauty blog.`),
      });
    }

    return NextResponse.json({
      pages,
      counts: {
        total: pages.length,
        products: products.length,
        categories: categories.length,
        brands: brands.length,
        blog: blog.length,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
