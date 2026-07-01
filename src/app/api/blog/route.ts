import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError } from "@/lib/validate";

interface BlogRow extends RowDataPacket { [key: string]: unknown; }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit")) || 20;
    const slug = searchParams.get("slug");
    if (slug) {
      const rows = await query<BlogRow[]>("SELECT * FROM blog_posts WHERE slug = ? LIMIT 1", [slug]);
      if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ...rows[0], tags: JSON.parse((rows[0].tags as string) || "[]"), is_published: !!rows[0].is_published });
    }
    const all = searchParams.get("all");
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
    const sql = all ? `SELECT * FROM blog_posts ORDER BY created_at DESC LIMIT ${safeLimit}` : `SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC LIMIT ${safeLimit}`;
    const rows = await query<BlogRow[]>(sql);
    return NextResponse.json(rows.map((r) => ({ ...r, tags: JSON.parse((r.tags as string) || "[]"), is_published: !!r.is_published })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validate([
      { field: "title", value: body.title, rules: ["required", "string", { minLength: 3 }], label: "Blog title" },
    ]);
    if (err) return validationError(err);
    const id = `blog-${Date.now()}`;
    const slug = body.slug || body.title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-");
    await execute(
      "INSERT INTO blog_posts (id, title, slug, excerpt, content, featured_image, category, tags, author_name, is_published, published_at, reading_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.title, slug, body.excerpt || null, body.content || null, body.featured_image || null, body.category || null, JSON.stringify(body.tags || []), body.author_name || "ChineXa Team", body.is_published ? 1 : 0, body.is_published ? new Date().toISOString().slice(0, 19).replace("T", " ") : null, body.reading_time || 5]
    );
    await logActivity("Created blog post", "blog", id, body.title);
    return NextResponse.json({ success: true, id, slug }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    if (message.includes("Duplicate entry")) {
      return NextResponse.json({ error: "A blog post with this title already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
