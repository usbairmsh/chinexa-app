import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.slug !== undefined) { fields.push("slug = ?"); values.push(body.slug); }
    if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }
    if (body.image !== undefined) { fields.push("image = ?"); values.push(body.image); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.order !== undefined) { fields.push("`order` = ?"); values.push(body.order); }
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    values.push(id);
    await execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Delete subcategories first (children with parent_id = this id)
    await execute("DELETE FROM categories WHERE parent_id = ?", [id]);
    // Delete the category (products.category_id will be SET NULL by FK constraint)
    await execute("DELETE FROM categories WHERE id = ?", [id]);
    await logActivity("Deleted category", "category", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
