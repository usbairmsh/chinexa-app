import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * Delete an uploaded file from disk given its URL path.
 * Accepts paths like:
 *   /api/uploads/products/filename.jpg
 *   /uploads/products/filename.jpg
 * Silently ignores if file doesn't exist or path is external.
 */
export async function deleteUploadedFile(url: string | null | undefined): Promise<void> {
  if (!url || url.startsWith("http") || url.startsWith("data:")) return;

  try {
    // Strip /api/uploads/ or /uploads/ prefix to get relative path
    let relativePath = url;
    if (relativePath.startsWith("/api/uploads/")) {
      relativePath = relativePath.slice("/api/uploads/".length);
    } else if (relativePath.startsWith("/uploads/")) {
      relativePath = relativePath.slice("/uploads/".length);
    } else {
      return; // Not an uploaded file path
    }

    const filePath = path.join(process.cwd(), "public", "uploads", relativePath);

    // Prevent directory traversal
    const resolved = path.resolve(filePath);
    const uploadsDir = path.resolve(path.join(process.cwd(), "public", "uploads"));
    if (!resolved.startsWith(uploadsDir)) return;

    if (existsSync(resolved)) {
      await unlink(resolved);
    }
  } catch {
    // Silently fail — don't break the delete operation
  }
}
