import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { publicServerError } from "@/lib/validate";

// Customer-facing: withdraw a return request while it's still 'requested'
// (before an admin has acted). Ownership verified via customer_id matching the
// return's order. Once approved, only admin controls it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const customerId = (body.customer_id || "").trim();

    const rows = await query<RowDataPacket[]>("SELECT * FROM order_returns WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Return not found" }, { status: 404 });
    const ret = rows[0];

    if (!customerId || !ret.customer_id || String(ret.customer_id) !== customerId) {
      return NextResponse.json({ error: "You can only withdraw your own return." }, { status: 403 });
    }
    if (ret.status !== "requested") {
      return NextResponse.json({ error: "This return can no longer be withdrawn." }, { status: 409 });
    }

    await execute("DELETE FROM order_returns WHERE id = ?", [id]);
    await logActivity("Return withdrawn by customer", "order", ret.order_id as string, `Order ${ret.order_number}`);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("POST /api/returns/[id]/withdraw", error);
  }
}
