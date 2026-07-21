import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";
import { deleteUploadedFile } from "@/lib/delete-upload";
import { recordStockHistory, handleRestockTransition } from "@/lib/migrate-inventory";

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

    // Snapshot this variant's + the product's stock BEFORE the write, so a
    // stock increase can be logged as a per-variant restock and a 0→positive
    // product transition can trigger back-in-stock notifications.
    const beforeRows = await query<RowDataPacket[]>(
      "SELECT pv.stock AS v_stock, pv.name AS v_name, pv.sku AS v_sku, p.stock_quantity AS p_stock FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ? LIMIT 1",
      [variantId]
    );
    const beforeVariantStock = Number(beforeRows[0]?.v_stock ?? 0);
    const beforeProductStock = Number(beforeRows[0]?.p_stock ?? 0);

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

    // Per-variant restock history + product-level back-in-stock check.
    if (body.stock !== undefined) {
      const afterVariantStock = Number(body.stock);
      const delta = afterVariantStock - beforeVariantStock;
      const variantSku = (body.sku as string) || (beforeRows[0]?.v_sku as string) || null;
      const variantName = (body.name as string) || (beforeRows[0]?.v_name as string) || null;
      if (delta > 0) {
        await recordStockHistory({ productId, variantSku, variantName, eventType: "restock", quantityChange: delta, resultingStock: afterVariantStock, note: "Variant stock updated", bumpRestockedAt: true });
      } else if (delta < 0) {
        await recordStockHistory({ productId, variantSku, variantName, eventType: "adjust", quantityChange: delta, resultingStock: afterVariantStock, note: "Variant stock reduced" });
      }
      // Product-level parent stock reflects the sum of variants; re-read it and
      // fire the transition if this bump brought the whole product back.
      const afterRows = await query<RowDataPacket[]>("SELECT stock_quantity FROM products WHERE id = ? LIMIT 1", [productId]);
      const afterProductStock = Number(afterRows[0]?.stock_quantity ?? beforeProductStock);
      await handleRestockTransition(productId, beforeProductStock, afterProductStock);
    }

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
