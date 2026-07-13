import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { bulkNotify, getAllCustomerIds, getTierCustomerIds, type NotificationType } from "@/lib/notify";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

const VALID_TYPES: NotificationType[] = ["order", "promo", "loyalty", "system"];

let tableEnsured = false;
async function ensureBroadcastTable() {
  if (tableEnsured) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS notification_broadcasts (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'system',
        link VARCHAR(500),
        audience VARCHAR(20) NOT NULL,
        audience_detail TEXT,
        recipient_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    tableEnsured = true;
  } catch (err) {
    console.error("[notification_broadcasts] table create failed:", err);
  }
}

// GET /api/notifications/send — broadcast history for the admin panel
export async function GET(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "customers", "view");
    if (denied) return denied;
    await ensureBroadcastTable();
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM notification_broadcasts ORDER BY created_at DESC LIMIT 50"
    );
    return NextResponse.json(rows.map((r) => ({ ...r, recipient_count: Number(r.recipient_count) || 0 })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/notifications/send — admin push notification
// Body: { title, message, type?, link?, audience: "all" | "tiers" | "customers", tier_ids?: string[], customer_ids?: string[] }
export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "customers", "add");
    if (denied) return denied;
    await ensureBroadcastTable();
    const body = await req.json();
    const title: string = (body.title || "").trim();
    const message: string = (body.message || "").trim();
    const type: NotificationType = VALID_TYPES.includes(body.type) ? body.type : "system";
    const link: string | null = (body.link || "").trim() || null;
    const audience: string = body.audience;

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
    if (!["all", "tiers", "customers"].includes(audience)) {
      return NextResponse.json({ error: "audience must be all, tiers or customers" }, { status: 400 });
    }

    // Resolve recipients
    let recipients: string[] = [];
    let audienceDetail = "";
    if (audience === "all") {
      recipients = await getAllCustomerIds();
      audienceDetail = "All customers";
    } else if (audience === "tiers") {
      const tierIds: string[] = Array.isArray(body.tier_ids) ? body.tier_ids : [];
      if (tierIds.length === 0) return NextResponse.json({ error: "Select at least one tier" }, { status: 400 });
      recipients = await getTierCustomerIds(tierIds);
      audienceDetail = `Tiers: ${tierIds.join(", ")}`;
    } else {
      const customerIds: string[] = Array.isArray(body.customer_ids) ? body.customer_ids : [];
      if (customerIds.length === 0) return NextResponse.json({ error: "Select at least one customer" }, { status: 400 });
      recipients = customerIds;
      audienceDetail = `${customerIds.length} selected customer${customerIds.length > 1 ? "s" : ""}`;
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No matching customers found for this audience" }, { status: 400 });
    }

    const sent = await bulkNotify(recipients, { type, title, message, link });

    // Record broadcast history
    const bid = `bcast-${Date.now()}`;
    await execute(
      "INSERT INTO notification_broadcasts (id, title, message, type, link, audience, audience_detail, recipient_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [bid, title, message, type, link, audience, audienceDetail, sent]
    ).catch(() => {});

    await logActivity("Sent notification broadcast", "settings", bid, `"${title}" → ${sent} customer${sent > 1 ? "s" : ""}`);
    return NextResponse.json({ success: true, sent }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
