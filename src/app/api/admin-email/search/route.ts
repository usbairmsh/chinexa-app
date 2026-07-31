import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { searchThreads } from "@/lib/email-inbox";
import { requirePermission, scopedMailboxIds, getRequester } from "@/lib/admin-permissions-server";
import { canAccessMailbox } from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";

// GET /api/admin-email/search?q=&direction=sent|received|all&from=&to=&mailbox_id=
// Filtered/searched thread list, scoped to the caller's permitted mailboxes.
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "view");
  if (denied) return denied;
  await ensureEmailInboxTables();

  const scope = (await scopedMailboxIds(req)) ?? [];
  const sp = req.nextUrl.searchParams;
  const requestedMailboxId = sp.get("mailbox_id") || undefined;
  const requester = await getRequester(req);
  // Honor a specific mailbox only if the caller is scoped to it.
  const mailboxId = requestedMailboxId && requester && canAccessMailbox(requester.role, requester.permissions, requestedMailboxId)
    ? requestedMailboxId
    : undefined;

  const directionRaw = sp.get("direction");
  const direction = directionRaw === "sent" || directionRaw === "received" ? directionRaw : "all";

  const threads = await searchThreads({
    scope,
    mailboxId,
    direction,
    q: sp.get("q") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  });

  return NextResponse.json({ threads }, { headers: { "Cache-Control": "no-store, must-revalidate" } });
}
