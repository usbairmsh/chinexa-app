import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { resetCounters } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// POST — reset the Sent / Received / Broadcast lifetime counters back to zero.
// Store-wide by default; pass { mailbox_id } to reset just one mailbox.
// Gated by the email_inbox "delete" permission (it clears data).
export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "delete");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const body = await req.json().catch(() => ({}));
  await resetCounters(typeof body.mailbox_id === "string" ? body.mailbox_id : undefined);
  return NextResponse.json({ ok: true });
}
