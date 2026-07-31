import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { listMailboxes, createMailbox, getMailboxByAddress } from "@/lib/email-inbox";
import { requirePermission, scopedMailboxIds, getRequester } from "@/lib/admin-permissions-server";
import { hasFullAccess } from "@/lib/admin-permissions";

export const dynamic = "force-dynamic";

// GET — list mailboxes. Scoped to the caller's permitted mailboxes, EXCEPT a
// superadmin may pass ?all=1 to get every mailbox (needed by the Users UI to
// configure per-admin mailbox access).
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "view");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const wantAll = req.nextUrl.searchParams.get("all") === "1";
  const requester = await getRequester(req);
  const scope = wantAll && requester && hasFullAccess(requester.role)
    ? "all"
    : ((await scopedMailboxIds(req)) ?? []);
  return NextResponse.json(
    { mailboxes: await listMailboxes(scope) },
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}

// POST — add a receiving/sending mailbox. Requires email_inbox manage_mailboxes
// (superadmin always qualifies via full-access).
export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "manage_mailboxes");
  if (denied) return denied;
  await ensureEmailInboxTables();

  const body = await req.json().catch(() => ({}));
  const address = String(body.address || "").toLowerCase().trim();
  const displayName = String(body.display_name || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }
  if (await getMailboxByAddress(address)) {
    return NextResponse.json({ error: "That address is already configured" }, { status: 409 });
  }

  const mailbox = await createMailbox({
    address,
    display_name: displayName,
    can_receive: body.can_receive !== false,
    can_send: body.can_send !== false,
    can_broadcast: body.can_broadcast === true,
  });
  return NextResponse.json({ mailbox }, { status: 201 });
}
