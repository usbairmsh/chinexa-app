import type { MetadataRoute } from "next";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  const staticPages = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/products", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/faq", priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" as const },
  ];

  for (const page of staticPages) {
    entries.push({
      url: `${siteUrl}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  try {
    // Products
    const [products] = await pool.execute<RowDataPacket[]>(
      "SELECT slug, updated_at FROM products WHERE is_active = 1 ORDER BY updated_at DESC"
    );
    for (const p of products) {
      entries.push({
        url: `${siteUrl}/products/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at as string) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // Categories
    const [categories] = await pool.execute<RowDataPacket[]>(
      "SELECT slug, updated_at FROM categories WHERE is_active = 1"
    );
    for (const c of categories) {
      entries.push({
        url: `${siteUrl}/categories/${c.slug}`,
        lastModified: c.updated_at ? new Date(c.updated_at as string) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    // Blog posts
    const [posts] = await pool.execute<RowDataPacket[]>(
      "SELECT slug, updated_at FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC"
    );
    for (const post of posts) {
      entries.push({
        url: `${siteUrl}/blog/${post.slug}`,
        lastModified: post.updated_at ? new Date(post.updated_at as string) : new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // If DB is not available, return static pages only
  }

  return entries;
}
