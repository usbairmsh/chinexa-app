import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { createAttachment, deleteAttachment, getAttachment } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Max 10 MB per file — Resend's total message cap is ~40 MB, so keep individual
// files modest. A conservative allow-list of business-document/image types.
const MAX_SIZE = 10 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt", "text/csv": "csv",
  "application/zip": "zip",
};

// POST — upload one attachment, staged against a compose_token (sending) so it
// can be linked to the message/draft later. Requires the send OR draft ability.
export async function POST(req: NextRequest) {
  const canSend = await requirePermission(req, "email_inbox", "add");
  const canDraft = await requirePermission(req, "email_inbox", "draft");
  if (canSend && canDraft) return canSend; // neither permission → 401/403
  await ensureEmailInboxTables();

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const composeToken = (form.get("compose_token") as string) || null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = EXT_BY_MIME[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Unsupported file type. Allowed: images, PDF, Word, Excel, txt, csv, zip." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }

    const uniqueId = crypto.randomBytes(8).toString("hex");
    const fileName = `${Date.now()}_${uniqueId}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "email");
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, fileName), buffer);

    // Keep the original (client) name for display, sanitized.
    const displayName = (file.name || fileName).replace(/[\r\n"\\]/g, "").slice(0, 255) || fileName;

    const attachment = await createAttachment({
      composeToken,
      direction: "outbound",
      filename: displayName,
      mimeType: file.type,
      size: file.size,
      url: `/api/uploads/email/${fileName}`,
    });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return publicServerError("POST /api/admin-email/attachments", error);
  }
}

// DELETE ?id= — remove a staged attachment (used when the admin removes it from
// the compose UI before sending).
export async function DELETE(req: NextRequest) {
  const canSend = await requirePermission(req, "email_inbox", "add");
  const canDraft = await requirePermission(req, "email_inbox", "draft");
  if (canSend && canDraft) return canSend;
  await ensureEmailInboxTables();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!(await getAttachment(id))) return NextResponse.json({ ok: true });
  await deleteAttachment(id);
  return NextResponse.json({ ok: true });
}
