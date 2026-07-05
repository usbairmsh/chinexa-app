import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { bulkNotify, resolvePromoRecipients } from "@/lib/notify";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensurePromotionColumns();
    const { id } = await params;
    const body = await req.json();

    // Snapshot before the update so we can detect a paused → active transition
    const beforeRows = await query<RowDataPacket[]>("SELECT is_active FROM coupons WHERE id = ? LIMIT 1", [id]);
    const wasActive = beforeRows.length > 0 && !!beforeRows[0].is_active;

    const fields: string[] = []; const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ code: "code", description: "description", discount_type: "discount_type", discount_value: "discount_value", min_order_amount: "min_order_amount", max_discount_amount: "max_discount_amount", usage_limit: "usage_limit", per_customer_limit: "per_customer_limit", applicability: "applicability" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.applicable_ids !== undefined) { fields.push("applicable_ids = ?"); values.push(JSON.stringify(body.applicable_ids || [])); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.valid_from !== undefined) { fields.push("valid_from = ?"); values.push(body.valid_from); }
    if (body.valid_until !== undefined) { fields.push("valid_until = ?"); values.push(body.valid_until); }
    if (fields.length > 0) { values.push(id); await execute(`UPDATE coupons SET ${fields.join(", ")} WHERE id = ?`, values); }
    await logActivity("Updated coupon", "coupon", id);

    // Notify customers when a coupon is switched ON (paused → active)
    if (body.is_active === true && !wasActive) {
      try {
        const rows = await query<RowDataPacket[]>("SELECT * FROM coupons WHERE id = ? LIMIT 1", [id]);
        if (rows.length > 0) {
          const c = rows[0];
          const discountLabel = c.discount_type === "fixed" ? `৳${Number(c.discount_value)} off` : `${Number(c.discount_value)}% off`;
          const minOrder = c.min_order_amount ? ` on orders above ৳${Number(c.min_order_amount)}` : "";
          const applicableIds: string[] = typeof c.applicable_ids === "string"
            ? JSON.parse(c.applicable_ids) : (c.applicable_ids as string[]) || [];
          const recipients = await resolvePromoRecipients((c.applicability as string) || "store", applicableIds);
          await bulkNotify(recipients, {
            type: "promo",
            title: `New Coupon: ${c.code}`,
            message: `Use code ${c.code} for ${discountLabel}${minOrder}. ${c.description || "Apply it at checkout!"}`,
            link: "/cart",
          });
        }
      } catch (err) {
        console.error("[coupons] activation notify failed:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await execute("DELETE FROM coupons WHERE id = ?", [id]); await logActivity("Deleted coupon", "coupon", id); return NextResponse.json({ success: true }); }
  catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 }); }
}
