// HARDCODED "apply" variant of compress-uploads — for containers where
// process.argv / process.env are stripped so flags can't be passed. This ALWAYS
// applies (writes compressed WebP in place) and keeps .orig backups.
//
//   node scripts/compress-uploads-apply.mjs
//
// After confirming the compressed images serve correctly (curl shows
// image/webp) and the site looks right, delete backups to reclaim space:
//   find public/uploads -name "*.orig" -delete
//
// To ALSO delete originals in the same run (irreversible), set DELETE = true
// below before running. Leave false for a safe, reversible run.

import { readdir, readFile, writeFile, rename } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";

const APPLY = true;      // always apply
const DELETE = false;    // set true to skip .orig backups (irreversible)

const CWD = typeof process?.cwd === "function" ? process.cwd() : ".";
const ROOT = path.join(CWD, "public", "uploads");
const MAX = 1600, Q = 80;

let scanned = 0, changed = 0, before = 0, after = 0, skipped = 0;

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { await walk(full); continue; }
    if (e.name.endsWith(".orig")) continue;
    const ext = path.extname(e.name).slice(1).toLowerCase();
    if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) continue;
    await process_(full, ext);
  }
}

async function process_(file, ext) {
  scanned++;
  const buf = await readFile(file);
  const size0 = buf.length;
  if (ext === "gif") {
    try { const m = await sharp(buf, { animated: true }).metadata(); if ((m.pages || 1) > 1) { skipped++; return; } }
    catch { skipped++; return; }
  }
  let out;
  try {
    out = await sharp(buf).rotate().resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: Q }).toBuffer();
    const chk = await sharp(out).metadata();
    if (!chk.width || !chk.height) throw new Error("invalid");
  } catch { skipped++; return; }
  before += size0;
  if (out.length >= size0) { after += size0; return; }
  after += out.length; changed++;
  const pct = (100 - (out.length / size0) * 100).toFixed(0);
  console.log(`✔ ${path.relative(ROOT, file)}  ${(size0/1024).toFixed(0)}KB → ${(out.length/1024).toFixed(0)}KB  (-${pct}%)`);
  if (APPLY) {
    if (!DELETE && !existsSync(file + ".orig")) await rename(file, file + ".orig").catch(() => {});
    await writeFile(file, out);
  }
}

console.log(`APPLYING (delete originals: ${DELETE}) — scanning ${ROOT}\n`);
await walk(ROOT);
console.log(`\n${scanned} scanned, ${changed} compressed, ${skipped} skipped.`);
console.log(`Total: ${(before/1024/1024).toFixed(1)}MB → ${(after/1024/1024).toFixed(1)}MB (saved ${((before-after)/1024/1024).toFixed(1)}MB, ${before?(100-(after/before)*100).toFixed(0):0}%)`);
if (!DELETE) console.log(`\nOriginals backed up as *.orig. After verifying images serve as image/webp and look right, run:\n  find public/uploads -name "*.orig" -delete`);
