import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { updateMailbox, deleteMailbox, getMailbox } from "@/lib/email-inbox";
import { requireSuperadmin } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// PUT — edit a mailbox's name / active / capability flags. Superadmin-only.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperadmin(req);
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;
  if (!(await getMailbox(id))) return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  await updateMailbox(id, {
    display_name: typeof body.display_name === "string" ? body.display_name : undefined,
    is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
    can_receive: typeof body.can_receive === "boolean" ? body.can_receive : undefined,
    can_send: typeof body.can_send === "boolean" ? body.can_send : undefined,
    can_broadcast: typeof body.can_broadcast === "boolean" ? body.can_broadcast : undefined,
  });
  return NextResponse.json({ mailbox: await getMailbox(id) });
}

// DELETE — remove a mailbox (cascades its threads/messages). Superadmin-only.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperadmin(req);
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;
  await deleteMailbox(id);
  return NextResponse.json({ ok: true });
}
