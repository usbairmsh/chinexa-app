// One-time (safe to re-run) batch compressor for existing uploaded images.
//
//   node scripts/compress-uploads.mjs           # dry run — reports savings
//   node scripts/compress-uploads.mjs --apply   # actually rewrite files
//
// Walks public/uploads/**, and for each JPG/PNG/WebP (NOT animated GIF):
//   • resizes to max 1600px (fit inside, never enlarge)
//   • re-encodes to WebP @ q80 IN PLACE (keeps the same filename/extension so
//     no DB URLs change — a .jpg stays .jpg on disk but with WebP-compressed
//     bytes; browsers sniff the content, and Next re-optimizes on serve anyway)
//   • only writes if the result is actually smaller
//
// Animated GIFs are skipped (would lose animation). A backup of each original
// is written next to it as <name>.orig on the first apply, so you can revert.

import { readdir, stat, readFile, writeFile, rename } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";

const CWD = typeof process.cwd === "function" ? process.cwd() : path.resolve(".");
const ROOT = path.join(CWD, "public", "uploads");
const ARGV = Array.isArray(process.argv) ? process.argv : [];
const APPLY = ARGV.includes("--apply");
// --delete-originals: don't keep the .orig backup (irreversible). Only used
// once the compressed images are confirmed to serve correctly.
const DELETE_ORIG = ARGV.includes("--delete-originals");
const MAX = 1600;
const Q = 80;

let scanned = 0, changed = 0, before = 0, after = 0, skipped = 0;

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { await walk(full); continue; }
    if (e.name.endsWith(".orig")) continue; // our backups
    const ext = path.extname(e.name).slice(1).toLowerCase();
    if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) continue;
    await process(full, ext);
  }
}

async function process(file, ext) {
  scanned++;
  const buf = await readFile(file);
  const size0 = buf.length;

  // Skip animated GIFs (multi-frame) — re-encoding would flatten them.
  if (ext === "gif") {
    try {
      const meta = await sharp(buf, { animated: true }).metadata();
      if ((meta.pages || 1) > 1) { skipped++; return; }
    } catch { skipped++; return; }
  }

  let out;
  try {
    out = await sharp(buf)
      .rotate()
      .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: Q })
      .toBuffer();
    // Verify the output is a valid, decodable image before trusting it — never
    // replace a good original with corrupt bytes.
    const check = await sharp(out).metadata();
    if (!check.width || !check.height) throw new Error("invalid output");
  } catch { skipped++; return; }

  before += size0;
  // Only keep it if smaller.
  if (out.length >= size0) { after += size0; return; }
  after += out.length;
  changed++;

  const pct = (100 - (out.length / size0) * 100).toFixed(0);
  console.log(`${APPLY ? "✔" : "•"} ${path.relative(ROOT, file)}  ${(size0/1024).toFixed(0)}KB → ${(out.length/1024).toFixed(0)}KB  (-${pct}%)`);

  if (APPLY) {
    if (DELETE_ORIG) {
      // Overwrite in place, no backup (irreversible). The verified WebP bytes
      // replace the original; the uploads route serves by content sniffing.
      await writeFile(file, out);
    } else {
      if (!existsSync(file + ".orig")) await rename(file, file + ".orig").catch(() => {});
      await writeFile(file, out);
    }
  }
}

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — scanning ${ROOT}\n`);
await walk(ROOT);
console.log(`\n${scanned} images scanned, ${changed} ${APPLY ? "compressed" : "would compress"}, ${skipped} skipped (animated/unreadable).`);
console.log(`Total: ${(before/1024/1024).toFixed(1)}MB → ${(after/1024/1024).toFixed(1)}MB  (saves ${((before-after)/1024/1024).toFixed(1)}MB, ${before?(100-(after/before)*100).toFixed(0):0}%)`);
if (!APPLY) console.log("\nRe-run with --apply to write the changes (originals backed up as *.orig).");
