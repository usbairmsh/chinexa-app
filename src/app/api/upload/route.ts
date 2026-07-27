import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { publicServerError } from "@/lib/validate";
import { getVerifiedAdminId } from "@/lib/admin-session";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "products";
    const productId = formData.get("product_id") as string | null;
    const imageIndex = formData.get("image_index") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type — and use THIS as the source of the saved file's
    // extension (never file.name, which is entirely client-controlled). A
    // request can set file.type to an allowed value while naming the file
    // e.g. "payload.svg" — /api/uploads/[...path] serves files back with a
    // Content-Type derived from the on-disk extension, so trusting the
    // client's filename would let an attacker get an arbitrary extension
    // (and, for .svg specifically, script-executing content) saved and
    // served from this app's own origin.
    const extByMimeType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
    };
    const ext = extByMimeType[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Invalid file type. Allowed: JPG, PNG, WebP, GIF, AVIF" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 5MB" }, { status: 400 });
    }

    // Sanitize folder name — only allow alphanumeric, dash, underscore
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) || "general";
    const uniqueId = crypto.randomBytes(8).toString("hex");
    let fileName: string;

    if (productId && imageIndex) {
      fileName = `${productId}_${imageIndex}_${uniqueId}.${ext}`;
    } else if (productId) {
      fileName = `${productId}_${uniqueId}.${ext}`;
    } else {
      fileName = `${Date.now()}_${uniqueId}.${ext}`;
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", safeFolder);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Return the API-served URL path
    const url = `/api/uploads/${safeFolder}/${fileName}`;

    return NextResponse.json({
      success: true,
      url,
      fileName,
      size: file.size,
      type: file.type,
    }, { status: 201 });
  } catch (error: unknown) {
    return publicServerError("POST /api/upload", error);
  }
}

// DELETE — remove a previously-uploaded file when an admin replaces/clears an
// image, so old files don't accumulate on disk. Admin-only, and strictly scoped
// to files under public/uploads (path-traversal guarded). Best-effort: a
// missing file or any failure returns ok so a cleanup call never blocks a save.
export async function DELETE(req: NextRequest) {
  // Admin session required — this deletes files from disk.
  if (!getVerifiedAdminId(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url).searchParams.get("url") || "";
    // Only accept our own served paths.
    const m = url.match(/^\/api\/uploads\/(.+)$/);
    if (!m) return NextResponse.json({ ok: true, skipped: "not an uploaded file" });

    const rel = m[1];
    const uploadsDir = path.resolve(path.join(process.cwd(), "public", "uploads"));
    const resolved = path.resolve(path.join(uploadsDir, ...rel.split("/")));
    // Path-traversal guard: must stay inside uploads/.
    if (!resolved.startsWith(uploadsDir + path.sep)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existsSync(resolved)) await unlink(resolved);
    return NextResponse.json({ ok: true });
  } catch {
    // Never fail a cleanup — the save already succeeded.
    return NextResponse.json({ ok: true });
  }
}
