import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import type { BlogPost } from "@/types/blog";

interface BlogRow extends RowDataPacket { [key: string]: unknown; }

/**
 * Shared single-post lookup — used by both /api/blog?slug=... and the blog
 * post page's server-side prefetch, so the two can never drift out of shape.
 */
export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const rows = await query<BlogRow[]>("SELECT * FROM blog_posts WHERE slug = ? LIMIT 1", [slug]);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags || "[]") : row.tags || [],
    is_published: !!row.is_published,
  } as unknown as BlogPost;
}
