import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";
import { deleteUploadedFile } from "@/lib/delete-upload";

// GET /api/products/[id]/variants/[variantId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  try {
    const { variantId } = await params;
    const rows = await query<RowDataPacket[]>("SELECT * FROM product_variants WHERE id = ? LIMIT 1", [variantId]);
    if (rows.length === 0) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// PUT /api/products/[id]/variants/[variantId]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  try {
    const denied = await requirePermission(req, "products", "edit");
    if (denied) return denied;
    const { id: productId, variantId } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [k, col] of Object.entries({
      name: "name", type: "type", value: "value", hex: "hex",
      price_adjustment: "price_adjustment", stock: "stock", sku: "sku",
      image: "image", focal_point: "focal_point",
    })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }

    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    values.push(variantId);
    await execute(`UPDATE product_variants SET ${fields.join(", ")} WHERE id = ?`, values);
    await logActivity("Updated product variant", "product", productId, `Variant ${variantId}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// DELETE /api/products/[id]/variants/[variantId]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  try {
    const denied = await requirePermission(req, "products", "delete");
    if (denied) return denied;
    const { id: productId, variantId } = await params;
    // Get variant image before deleting
    const rows = await query<RowDataPacket[]>("SELECT image FROM product_variants WHERE id = ?", [variantId]);
    await execute("DELETE FROM product_variants WHERE id = ?", [variantId]);
    if (rows.length > 0) await deleteUploadedFile(rows[0].image as string);
    await logActivity("Deleted product variant", "product", productId, `Variant ${variantId}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
