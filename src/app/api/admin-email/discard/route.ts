import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { discardComposeToken } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// POST { compose_token } — discard an abandoned compose session: deletes every
// staged upload (inline images + file attachments) under the token that was
// never linked to a sent message or saved draft, freeing the disk space.
// Best-effort; requires email_inbox send OR draft ability.
export async function POST(req: NextRequest) {
  const canSend = await requirePermission(req, "email_inbox", "add");
  const canDraft = await requirePermission(req, "email_inbox", "draft");
  if (canSend && canDraft) return canSend; // neither → 401/403
  await ensureEmailInboxTables();

  const body = await req.json().catch(() => ({}));
  const token = typeof body.compose_token === "string" ? body.compose_token : "";
  if (token) await discardComposeToken(token);
  return NextResponse.json({ ok: true });
}
