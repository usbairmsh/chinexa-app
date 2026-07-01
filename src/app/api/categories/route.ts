import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError, dependencyError } from "@/lib/validate";

interface CategoryRow extends RowDataPacket {
  id: string; name: string; slug: string; description: string | null;
  image: string | null; parent_id: string | null; order: number;
  is_active: number; product_count: number; created_at: string;
}

export async function GET() {
  try {
    const rows = await query<CategoryRow[]>("SELECT * FROM categories ORDER BY `order`");

    // Get live product counts per category
    interface CountRow extends RowDataPacket { category_id: string; count: number; }
    const counts = await query<CountRow[]>("SELECT category_id, COUNT(*) as count FROM products WHERE is_active = 1 AND category_id IS NOT NULL GROUP BY category_id");
    const countMap = new Map(counts.map((c) => [c.category_id, c.count]));

    const parents = rows.filter((r) => !r.parent_id).map((r) => ({
      id: r.id, name: r.name, slug: r.slug, description: r.description || undefined,
      image: r.image || undefined, order: r.order, is_active: !!r.is_active,
      product_count: countMap.get(r.id) || 0, created_at: r.created_at,
      children: rows.filter((c) => c.parent_id === r.id).map((c) => ({
        id: c.id, name: c.name, slug: c.slug, parent_id: c.parent_id,
        order: c.order, is_active: !!c.is_active, product_count: countMap.get(c.id) || 0, created_at: c.created_at,
      })),
    }));
    return NextResponse.json(parents);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// PUT /api/categories — Bulk reorder: { ids: ["cat-1", "cat-2", ...] }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: string[] = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }
    for (let i = 0; i < ids.length; i++) {
      await execute("UPDATE categories SET `order` = ? WHERE id = ?", [i, ids[i]]);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validate([
      { field: "name", value: body.name, rules: ["required", "string", { minLength: 2 }], label: "Category name" },
    ]);
    if (err) return validationError(err);
    if (body.parent_id) {
      const parent = await query<RowDataPacket[]>("SELECT id FROM categories WHERE id = ?", [body.parent_id]);
      if (parent.length === 0) return dependencyError("Parent category", body.parent_id);
    }
    const id = body.id || `cat-${Date.now()}`;
    const slug = body.slug || body.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-");
    await execute(
      "INSERT INTO categories (id, name, slug, description, image, parent_id, `order`, is_active, product_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.name, slug, body.description || null, body.image || null, body.parent_id || null, body.order || 0, body.is_active !== false ? 1 : 0, 0]
    );
    await logActivity("Created category", "category", id, body.name);
    return NextResponse.json({ success: true, id, slug }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    if (message.includes("Duplicate entry")) {
      return NextResponse.json({ error: "A category with this slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
