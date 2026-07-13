import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { deleteUploadedFile } from "@/lib/delete-upload";
import { requirePermission } from "@/lib/admin-permissions-server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "banners", "edit");
    if (denied) return denied;
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = []; const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ title: "title", subtitle: "subtitle", image: "image", mobile_image: "mobile_image", link: "link", cta_text: "cta_text", position: "position", focal_point: "focal_point", order: "`order`" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.settings !== undefined) { fields.push("settings = ?"); values.push(body.settings ? JSON.stringify(body.settings) : null); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
    values.push(id);
    await execute(`UPDATE banners SET ${fields.join(", ")} WHERE id = ?`, values);
    await logActivity("Updated banner", "banner", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "banners", "delete");
    if (denied) return denied;
    const { id } = await params;
    const rows = await query<RowDataPacket[]>("SELECT image, mobile_image FROM banners WHERE id = ?", [id]);
    await execute("DELETE FROM banners WHERE id = ?", [id]);
    if (rows.length > 0) {
      await deleteUploadedFile(rows[0].image as string);
      await deleteUploadedFile(rows[0].mobile_image as string);
    }
    await logActivity("Deleted banner", "banner", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
