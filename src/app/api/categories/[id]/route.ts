import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { deleteUploadedFile } from "@/lib/delete-upload";
import { publicServerError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const denied = await requirePermission(req, "categories", "edit");
    if (denied) return denied;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.slug !== undefined) { fields.push("slug = ?"); values.push(body.slug); }
    if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }
    if (body.image !== undefined) { fields.push("image = ?"); values.push(body.image); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.order !== undefined) { fields.push("`order` = ?"); values.push(body.order); }
    if (body.brand_ids !== undefined) { fields.push("brand_ids = ?"); values.push(JSON.stringify(body.brand_ids)); }
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    values.push(id);
    await execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, values);
    await logActivity("Updated category", "category", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("PUT /api/categories/[id]", error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const denied = await requirePermission(req, "categories", "delete");
    if (denied) return denied;
    // Get images before deleting
    const cats = await query<RowDataPacket[]>("SELECT image FROM categories WHERE id = ? OR parent_id = ?", [id, id]);
    // Delete subcategories first, then the category
    await execute("DELETE FROM categories WHERE parent_id = ?", [id]);
    await execute("DELETE FROM categories WHERE id = ?", [id]);
    // Clean up image files
    for (const cat of cats) {
      await deleteUploadedFile(cat.image as string);
    }
    await logActivity("Deleted category", "category", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("DELETE /api/categories/[id]", error);
  }
}
