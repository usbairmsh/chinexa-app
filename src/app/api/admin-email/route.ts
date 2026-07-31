import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { listMailboxes, listThreads, emailCounts, listDrafts } from "@/lib/email-inbox";
import { canDo, canAccessMailbox } from "@/lib/admin-permissions";
import { getRequester } from "@/lib/admin-permissions-server";
import { requirePermission, scopedMailboxIds } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// GET /api/admin-email?mailbox_id= — the dashboard payload: mailboxes, the
// selected mailbox's threads, and the sent/received/total counters (scoped to
// the mailbox when given, else store-wide). The counts are always returned so
// the dashboard header can show Sent / Received / Total at a glance.
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "view");
  if (denied) return denied;
  await ensureEmailInboxTables();

  // Restrict everything to the caller's mailbox scope. A scoped admin only sees
  // their permitted mailboxes, the threads inside them, and scoped counters.
  const scope = await scopedMailboxIds(req); // "all" | string[] | null
  const requester = await getRequester(req);
  const requestedMailboxId = req.nextUrl.searchParams.get("mailbox_id") || undefined;
  // Ignore a mailbox_id the caller isn't scoped to (falls back to the scoped list).
  const mailboxId = requestedMailboxId && requester && canAccessMailbox(requester.role, requester.permissions, requestedMailboxId)
    ? requestedMailboxId
    : undefined;
  const effScope = scope ?? [];
  const [mailboxes, threads, counts, totals] = await Promise.all([
    listMailboxes(effScope),
    listThreads(mailboxId, effScope),
    emailCounts(mailboxId, effScope),
    // Scoped store-wide totals for the dashboard summary regardless of selection.
    emailCounts(undefined, effScope),
  ]);

  // Include a draft count so the UI can badge the Drafts inbox — only for
  // admins who can access drafts.
  let draftCount = 0;
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
