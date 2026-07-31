import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { listMailboxes, listThreads, emailCounts, listDrafts } from "@/lib/email-inbox";
import { canDo } from "@/lib/admin-permissions";
import { getRequester } from "@/lib/admin-permissions-server";
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

  // Include a draft count so the UI can badge the Drafts inbox — only for
  // admins who can access drafts.
  let draftCount = 0;
  const requester = await getRequester(req);
  if (requester && canDo(requester.role, requester.permissions, "email_inbox", "draft")) {
    draftCount = (await listDrafts()).length;
  }

  // Admin-only, always-fresh data. force-dynamic stops Next's server cache, but
  // without no-store the BROWSER caches this GET and replays a stale mailbox/
  // thread list — so a newly-created mailbox appeared "missing" even though it
  // was saved (re-adding it reported "already configured"). no-store fixes that.
  return NextResponse.json(
    { mailboxes, threads, counts, totals, draft_count: draftCount },
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}
