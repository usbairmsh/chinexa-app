import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

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

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: JPG, PNG, WebP, GIF, AVIF" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 5MB" }, { status: 400 });
    }

    // Sanitize folder name — only allow alphanumeric, dash, underscore
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) || "general";

    // Generate unique filename
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
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
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
