import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensureChatTables, newConversationId } from "@/lib/chat";
import { publicServerError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// GET — admin: list all conversations, sorted by most recent activity.
//       customer/guest: get-or-create their own single conversation.
export async function GET(req: NextRequest) {
  await ensureChatTables();
  const { searchParams } = req.nextUrl;
  const forAdmin = searchParams.get("admin") === "1";

  try {
    if (forAdmin) {
      const rows = await query<RowDataPacket[]>(
        `SELECT * FROM chat_conversations ORDER BY last_message_at DESC`
      );

      // Attach phone + membership tier so the inbox can show/filter by them —
      // same resolution used by /api/customers (points bucketed into
      // membership_tiers ranges). Guests have no customer_id, so they get a
      // fixed "Guest" pseudo-tier instead of a real one.
      const customerIds = rows.map((r) => r.customer_id as string).filter(Boolean);
      let phoneById = new Map<string, string>();
      let avatarById = new Map<string, string>();
      let pointsById = new Map<string, number>();
      if (customerIds.length > 0) {
        const placeholders = customerIds.map(() => "?").join(",");
        const custRows = await query<RowDataPacket[]>(
          `SELECT id, phone, avatar FROM customers WHERE id IN (${placeholders})`,
          customerIds
        );
        phoneById = new Map(custRows.map((r) => [r.id as string, r.phone as string]));
        avatarById = new Map(custRows.filter((r) => r.avatar).map((r) => [r.id as string, r.avatar as string]));

        const pointsRows = await query<RowDataPacket[]>(
          `SELECT customer_id, COALESCE(SUM(points), 0) as total_points FROM customer_points WHERE customer_id IN (${placeholders}) GROUP BY customer_id`,
          customerIds
        );
        pointsById = new Map(pointsRows.map((r) => [r.customer_id as string, Number(r.total_points)]));
      }

      const tierRows = await query<RowDataPacket[]>(
        "SELECT name, min_points, max_points FROM membership_tiers WHERE is_active = 1 ORDER BY sort_order ASC"
      );
      const tiers = tierRows.map((t) => ({ name: t.name as string, min: Number(t.min_points), max: Number(t.max_points) }));
      const resolveTier = (points: number): string => {
        const match = tiers.find((t) => points >= t.min && points <= t.max);
        return match?.name || tiers[0]?.name || "Bronze";
      };

      return NextResponse.json(rows.map((r) => {
        const customerId = r.customer_id as string | null;
        return {
          ...r,
          phone: customerId ? phoneById.get(customerId) || null : null,
          avatar: customerId ? avatarById.get(customerId) || null : null,
          tier: customerId ? resolveTier(pointsById.get(customerId) || 0) : "Guest",
        };
      }));
    }

    const customerId = searchParams.get("customer_id");
    const guestId = searchParams.get("guest_id");
    const displayName = searchParams.get("display_name") || "Guest";
    if (!customerId && !guestId) {
      return NextResponse.json({ error: "customer_id or guest_id required" }, { status: 400 });
    }

    const existing = await query<RowDataPacket[]>(
      customerId
        ? "SELECT * FROM chat_conversations WHERE customer_id = ? LIMIT 1"
        : "SELECT * FROM chat_conversations WHERE guest_id = ? LIMIT 1",
      [customerId || guestId!]
    );
    if (existing.length > 0) {
      // Keep the stored display name current (e.g. phone number may not have
      // been known yet when a guest conversation was first created).
      if (existing[0].display_name !== displayName) {
        await execute("UPDATE chat_conversations SET display_name = ? WHERE id = ?", [displayName, existing[0].id]);
        existing[0].display_name = displayName;
      }
      return NextResponse.json(existing[0]);
    }

    const id = newConversationId();
    await execute(
      "INSERT INTO chat_conversations (id, customer_id, guest_id, display_name) VALUES (?, ?, ?, ?)",
      [id, customerId || null, customerId ? null : guestId, displayName]
    );
    const created = await query<RowDataPacket[]>("SELECT * FROM chat_conversations WHERE id = ?", [id]);
    return NextResponse.json(created[0]);
  } catch (error: unknown) {
    return publicServerError("GET /api/chat/conversations", error);
  }
}

// DELETE — admin only: permanently remove a conversation and all its
// messages (chat_messages cascades via its FOREIGN KEY ... ON DELETE CASCADE).
export async function DELETE(req: NextRequest) {
  await ensureChatTables();
  const denied = await requirePermission(req, "support_inbox", "delete");
  if (denied) return denied;
  const conversationId = req.nextUrl.searchParams.get("id");
  if (!conversationId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const result = await execute("DELETE FROM chat_conversations WHERE id = ?", [conversationId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("DELETE /api/chat/conversations", error);
  }
}
