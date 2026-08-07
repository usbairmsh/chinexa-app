import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { publicServerError } from "@/lib/validate";
import { getVerifiedCustomerId } from "@/lib/customer-session";
import { getVerifiedAdminId } from "@/lib/admin-session";

// Customer-facing: withdraw a return request while it's still 'requested'
// (before an admin has acted). Ownership verified via customer_id matching the
// return's order. Once approved, only admin controls it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const isAdmin = !!getVerifiedAdminId(req);
    const sessionId = getVerifiedCustomerId(req);

    const rows = await query<RowDataPacket[]>("SELECT * FROM order_returns WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Return not found" }, { status: 404 });
    const ret = rows[0];

    // Ownership derives from the SESSION, not a client-supplied customer_id — a
    // guessed id must not let anyone withdraw someone else's return. Admins may
    // withdraw any.
    if (!isAdmin) {
      const ownerId = String(ret.customer_id ?? "");
      if (!sessionId || !ownerId || ownerId !== sessionId) {
        return NextResponse.json({ error: "You can only withdraw your own return." }, { status: 403 });
      }
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
