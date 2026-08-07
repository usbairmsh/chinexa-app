import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensureNotificationTables } from "@/lib/notify";
import { publicServerError } from "@/lib/validate";
import { getVerifiedCustomerId } from "@/lib/customer-session";
import { getVerifiedAdminId } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

// Resolve the customer id this request may act on. The id must come from the
// signed session cookie, OR the caller must be an admin (who may name any id).
// A client-supplied id is never trusted alone; a signed-in customer naming a
// DIFFERENT id is rejected.
function scopeCustomerId(req: NextRequest, clientId: string | null | undefined):
  { id: string } | { error: NextResponse } {
  const sessionId = getVerifiedCustomerId(req);
  const isAdmin = !!getVerifiedAdminId(req);
  const scopedId = isAdmin ? String(clientId || "") : sessionId;
  if (!scopedId) return { error: NextResponse.json({ error: "Not authorized" }, { status: 401 }) };
  if (!isAdmin && clientId && String(clientId) !== sessionId) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  return { id: scopedId };
}

// GET /api/notifications?customer_id=xxx — list (or ?count_only=1 for the unread badge)
export async function GET(req: NextRequest) {
  try {
    await ensureNotificationTables();
    const scoped = scopeCustomerId(req, req.nextUrl.searchParams.get("customer_id"));
    if ("error" in scoped) return scoped.error;
    const customerId = scoped.id;

    if (req.nextUrl.searchParams.get("count_only")) {
      const rows = await query<RowDataPacket[]>(
        "SELECT COUNT(*) AS unread FROM customer_notifications WHERE customer_id = ? AND is_read = FALSE",
        [customerId]
      );
      return NextResponse.json({ unread: Number(rows[0]?.unread) || 0 });
    }

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM customer_notifications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50",
      [customerId]
    );
    return NextResponse.json(rows.map((r) => ({ ...r, is_read: !!r.is_read })));
  } catch (error: unknown) {
    return publicServerError("GET /api/notifications", error);
  }
}

// POST /api/notifications — create notification + mark read
export async function POST(req: NextRequest) {
  try {
    await ensureNotificationTables();
    const body = await req.json();
    const isAdmin = !!getVerifiedAdminId(req);

    // Mark all as read — owner-or-admin on the target customer.
    if (body.action === "mark_all_read" && body.customer_id) {
      const scoped = scopeCustomerId(req, body.customer_id);
      if ("error" in scoped) return scoped.error;
      await execute("UPDATE customer_notifications SET is_read = TRUE WHERE customer_id = ?", [scoped.id]);
      return NextResponse.json({ success: true });
    }

    // Mark single as read — scope the UPDATE to the session customer so a
    // caller can only mark their OWN notifications (admins may mark any).
    if (body.action === "mark_read" && body.id) {
      if (isAdmin) {
        await execute("UPDATE customer_notifications SET is_read = TRUE WHERE id = ?", [body.id]);
      } else {
        const sessionId = getVerifiedCustomerId(req);
        if (!sessionId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
        await execute("UPDATE customer_notifications SET is_read = TRUE WHERE id = ? AND customer_id = ?", [body.id, sessionId]);
      }
      return NextResponse.json({ success: true });
    }

    // Create notification — admin-ONLY. Creating a notification with an
    // arbitrary customer_id/title/link on behalf of another account is an
    // abuse vector, so this requires a verified admin session.
    if (body.customer_id && body.title && body.message) {
      if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await execute(
        "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)",
        [id, body.customer_id, body.type || "system", body.title, body.message, body.link || null]
      );
      return NextResponse.json({ success: true, id }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    return publicServerError("POST /api/notifications", error);
  }
}
