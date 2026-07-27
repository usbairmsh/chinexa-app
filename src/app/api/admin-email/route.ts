import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { listMailboxes, listThreads, emailCounts } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// GET /api/admin-email?mailbox_id= — the dashboard payload: mailboxes, the
// selected mailbox's threads, and the sent/received/total counters (scoped to
// the mailbox when given, else store-wide). The counts are always returned so
// the dashboard header can show Sent / Received / Total at a glance.
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "view");
  if (denied) return denied;
  await ensureEmailInboxTables();

  const mailboxId = req.nextUrl.searchParams.get("mailbox_id") || undefined;
  const [mailboxes, threads, counts, totals] = await Promise.all([
    listMailboxes(),
    listThreads(mailboxId),
    emailCounts(mailboxId),
    // Store-wide totals for the dashboard summary regardless of selected mailbox.
    emailCounts(undefined),
  ]);

  return NextResponse.json({ mailboxes, threads, counts, totals });
}
