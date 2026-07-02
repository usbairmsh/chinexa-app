import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { deleteUploadedFile } from "@/lib/delete-upload";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM brands WHERE slug = ? OR id = ? LIMIT 1",
      [id, id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const r = rows[0];
    return NextResponse.json({
      ...r,
      is_active: !!r.is_active,
      show_on_homepage: !!r.show_on_homepage,
      certifications: typeof r.certifications === "string" ? JSON.parse(r.certifications) : r.certifications || [],
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ name: "name", slug: "slug", logo: "logo", country: "country", description: "description", website: "website" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.certifications !== undefined) { fields.push("certifications = ?"); values.push(JSON.stringify(body.certifications)); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.show_on_homepage !== undefined) { fields.push("show_on_homepage = ?"); values.push(body.show_on_homepage ? 1 : 0); }
    if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
    values.push(id);
    await execute(`UPDATE brands SET ${fields.join(", ")} WHERE id = ?`, values);
    await logActivity("Updated brand", "brand", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await query<RowDataPacket[]>("SELECT logo FROM brands WHERE id = ?", [id]);
    await execute("UPDATE products SET brand_id = NULL, brand_name = NULL WHERE brand_id = ?", [id]);
    await execute("DELETE FROM brands WHERE id = ?", [id]);
    if (rows.length > 0) await deleteUploadedFile(rows[0].logo as string);
    await logActivity("Deleted brand", "brand", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
