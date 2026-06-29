import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [k, col] of Object.entries({
      title: "title", slug: "slug", excerpt: "excerpt", content: "content",
      featured_image: "featured_image", category: "category", author_name: "author_name",
      reading_time: "reading_time", seo_title: "seo_title", seo_description: "seo_description",
    })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.tags !== undefined) { fields.push("tags = ?"); values.push(JSON.stringify(body.tags)); }
    if (body.is_published !== undefined) {
      fields.push("is_published = ?");
      values.push(body.is_published ? 1 : 0);
      // Set published_at when first published
      if (body.is_published) {
        fields.push("published_at = COALESCE(published_at, NOW())");
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
    values.push(id);
    await execute(`UPDATE blog_posts SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await execute("DELETE FROM blog_posts WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
