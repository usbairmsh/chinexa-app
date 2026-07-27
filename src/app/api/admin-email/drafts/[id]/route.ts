import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getDraft, updateDraft, deleteDraft } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// PUT — edit a saved draft. Gated by "draft".
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "draft");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;
  if (!(await getDraft(id))) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  await updateDraft(id, {
    mailbox_id: body.mailbox_id !== undefined ? (body.mailbox_id || null) : undefined,
    to_address: body.to_address !== undefined ? (body.to_address || null) : undefined,
    subject: typeof body.subject === "string" ? body.subject : undefined,
    body_text: body.body_html !== undefined ? body.body_html : (body.body !== undefined ? body.body : (body.body_text !== undefined ? body.body_text : undefined)),
    segment: body.segment !== undefined ? body.segment : undefined,
  });
  return NextResponse.json({ draft: await getDraft(id) });
}

// DELETE — discard a draft. Gated by "draft".
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "draft");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;
  await deleteDraft(id);
  return NextResponse.json({ ok: true });
}
