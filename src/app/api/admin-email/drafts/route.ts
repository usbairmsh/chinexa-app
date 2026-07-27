import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { listDrafts, createDraft } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";
import { getVerifiedAdminId } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

// GET — the Drafts inbox. Gated by the email_inbox "draft" permission.
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "draft");
  if (denied) return denied;
  await ensureEmailInboxTables();
  return NextResponse.json({ drafts: await listDrafts() });
}

// POST — save a new draft (reply or broadcast). Gated by "draft".
export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "draft");
  if (denied) return denied;
  await ensureEmailInboxTables();

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "broadcast" ? "broadcast" : "reply";

  const draft = await createDraft({
    kind,
    mailbox_id: body.mailbox_id || null,
    thread_id: body.thread_id || null,
    from_address: body.from_address || null,
    to_address: body.to_address || null,
    subject: String(body.subject || "(no subject)"),
    body_text: typeof body.body === "string" ? body.body : (body.body_text ?? null),
    segment: body.segment ?? null,
    created_by: getVerifiedAdminId(req),
  });
  return NextResponse.json({ draft }, { status: 201 });
}
