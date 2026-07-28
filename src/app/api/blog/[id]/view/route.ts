import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/blog/<slug>/view — increment a published post's view counter.
// The dynamic segment is named `id` to match the sibling /api/blog/[id] route
// (Next.js forbids mixing [id] and [slug] at the same path level), but the
// client passes the post SLUG here, so we match on slug.
// Public; the client de-dupes per session so a refresh doesn't over-count.
// Best-effort — a failure here must never break reading the post.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: slug } = await params;
    if (slug) {
      await execute("UPDATE blog_posts SET views = views + 1 WHERE slug = ? AND is_published = 1", [slug]);
    }
  } catch {
    // ignore — view counting is non-critical
  }
  return NextResponse.json({ ok: true });
}
