import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { bulkNotify, resolvePromoRecipients } from "@/lib/notify";
import { validationError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "offers", "edit");
    if (denied) return denied;
    await ensurePromotionColumns();
    const { id } = await params;
    const body = await req.json();

    // Snapshot before the update so we can detect a paused → active transition
    // AND so cross-field validation below has the current value for whichever
    // side isn't part of THIS request (PUT is a partial update) — previously
    // this route had NO re-validation at all, so a direct PUT could push a
    // discount over 100%, invert the date range, or clear applicable_ids on a
    // scoped offer.
    const beforeRows = await query<RowDataPacket[]>(
      "SELECT is_active, discount_type, discount_value, start_date, end_date, applicability, applicable_ids FROM offers WHERE id = ? LIMIT 1",
      [id]
    );
    if (beforeRows.length === 0) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    const before = beforeRows[0];
    const wasActive = !!before.is_active;

    if (body.discount_value !== undefined) {
      const discountNum = Number(body.discount_value);
      if (!Number.isFinite(discountNum) || discountNum <= 0) {
        return validationError("Discount value must be greater than zero");
      }
    }
    const effectiveDiscountType = body.discount_type !== undefined ? body.discount_type : before.discount_type;
    const effectiveDiscountValue = body.discount_value !== undefined ? Number(body.discount_value) : Number(before.discount_value);
    if (effectiveDiscountType === "percentage" && effectiveDiscountValue > 100) {
      return validationError("Percentage discount cannot exceed 100%");
    }
    const effectiveStartDate = body.start_date !== undefined ? body.start_date : before.start_date;
    const effectiveEndDate = body.end_date !== undefined ? body.end_date : before.end_date;
    if (effectiveStartDate && effectiveEndDate && new Date(effectiveStartDate) >= new Date(effectiveEndDate)) {
      return validationError("Start date must be before end date");
    }
    const scopedApplicability = ["products", "categories", "subcategories", "brands", "customers", "tiers"];
    const effectiveApplicability = body.applicability !== undefined ? body.applicability : before.applicability;
    const effectiveApplicableIds = body.applicable_ids !== undefined
      ? body.applicable_ids
      : (typeof before.applicable_ids === "string" ? JSON.parse(before.applicable_ids) : before.applicable_ids || []);
    if (scopedApplicability.includes(effectiveApplicability) && (!Array.isArray(effectiveApplicableIds) || effectiveApplicableIds.length === 0)) {
      return validationError(`Select at least one ${effectiveApplicability === "customers" ? "customer" : effectiveApplicability === "tiers" ? "tier" : String(effectiveApplicability).replace(/s$/, "")} for this offer to apply to`);
    }

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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "offers", "delete");
    if (denied) return denied;
    const { id } = await params;
    await execute("DELETE FROM offers WHERE id = ?", [id]);
    await logActivity("Deleted offer", "offer", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
