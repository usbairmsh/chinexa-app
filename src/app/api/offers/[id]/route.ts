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
    const beforeRows = await query<RowDataPacket[]>("SELECT is_active FROM offers WHERE id = ? LIMIT 1", [id]);
    const wasActive = beforeRows.length > 0 && !!beforeRows[0].is_active;
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ title: "title", description: "description", applicability: "applicability", discount: "discount", discount_type: "discount_type", start_date: "start_date", end_date: "end_date" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.discount_value !== undefined) { fields.push("discount_value = ?"); values.push(Number(body.discount_value) || 0); }
    if (body.max_discount_amount !== undefined) {
      fields.push("max_discount_amount = ?");
      values.push(body.max_discount_amount != null && body.max_discount_amount !== "" ? Number(body.max_discount_amount) : null);
    }
    if (body.applicable_ids !== undefined) {
      fields.push("applicable_ids = ?");
      values.push(JSON.stringify(body.applicable_ids));
    }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
    values.push(id);
    await execute(`UPDATE offers SET ${fields.join(", ")} WHERE id = ?`, values);
    await logActivity("Updated offer", "offer", id);

    // Notify customers when an offer is switched ON (paused → active)
    if (body.is_active === true && !wasActive) {
      try {
        const rows = await query<RowDataPacket[]>("SELECT * FROM offers WHERE id = ? LIMIT 1", [id]);
        if (rows.length > 0) {
          const offer = rows[0];
          const applicableIds: string[] = typeof offer.applicable_ids === "string"
            ? JSON.parse(offer.applicable_ids) : (offer.applicable_ids as string[]) || [];
          const recipients = await resolvePromoRecipients(offer.applicability as string, applicableIds);
          await bulkNotify(recipients, {
            type: "promo",
            title: `New Offer: ${offer.title}`,
            message: `${offer.discount}${offer.description ? ` — ${offer.description}` : ""}. Shop now and save!`,
            link: "/products",
          });
        }
      } catch (err) {
        console.error("[offers] activation notify failed:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await execute("DELETE FROM offers WHERE id = ?", [id]);
    await logActivity("Deleted offer", "offer", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
