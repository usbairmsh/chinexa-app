import cron from "node-cron";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensureTagTables } from "@/lib/migrate-tags";
import { getTags } from "@/lib/tags-server";
import { isExpired, parseJsonArray, type Tag } from "@/lib/tags";

// ─── Expired-tag sweep ────────────────────────────────────────────────────────
// A tag with a validity period stops applying once that period is up. Rather
// than adding an expiry check to every badge query — products.ts, the
// /collections/* routes, /exclusive, the homepage sections and the pre-order
// filter all read badges independently — the expired slug is removed from the
// product. Every existing query then keeps working untouched, and the stored
// data stays honest.
//
// Only free-floating tags can expire: an attached tag lives as long as what it
// is attached to, and system tags are never swept (removing `preorder` would
// break the out-of-stock flow). Both rules come from isExpired() in lib/tags.ts.

const SWEEP_CRON = "*/15 * * * *"; // every 15 minutes

let started = false;

/**
 * Strip expired tag slugs from every product carrying one.
 * Returns how many products were changed. Safe to call concurrently — each
 * product is rewritten from its own current row.
 */
export async function sweepExpiredTags(): Promise<number> {
  await ensureTagTables();

  const tags = await getTags();
  // Only tags that CAN expire are worth scanning for.
  const expiring = tags.filter((t) => !t.is_system && t.attach_type === "none" && t.validity_mode !== "none");
  if (expiring.length === 0) return 0;

  const bySlug = new Map<string, Tag>(expiring.map((t) => [t.slug, t]));
  const now = new Date();

  // Narrow to products that carry at least one expiring slug, so the sweep
  // doesn't walk the whole catalogue every quarter hour.
  const conditions = expiring.map(() => "JSON_CONTAINS(badges, JSON_QUOTE(?))").join(" OR ");
  const rows = await query<RowDataPacket[]>(
    `SELECT id, badges, hidden_card_badges, badge_applied_at
     FROM products WHERE badges IS NOT NULL AND (${conditions})`,
    expiring.map((t) => t.slug)
  );

  let changed = 0;
  for (const row of rows) {
    const badges = parseJsonArray(row.badges);

    let applied: Record<string, string> = {};
    try {
      const raw = typeof row.badge_applied_at === "string" ? JSON.parse(row.badge_applied_at) : row.badge_applied_at;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) applied = raw as Record<string, string>;
    } catch {
      // Unparseable — every appliedAt reads as null below, and isExpired()
      // treats an unknown application date as "not expired", so nothing is
      // dropped. Failing safe here is deliberate.
    }

    const kept = badges.filter((slug) => {
      const tag = bySlug.get(slug);
      if (!tag) return true; // not an expiring tag — leave it alone
      return !isExpired(tag, applied[slug] ?? null, now);
    });

    if (kept.length === badges.length) continue;

    const removed = badges.filter((b) => !kept.includes(b));
    const hidden = parseJsonArray(row.hidden_card_badges).filter((b) => kept.includes(b));
    const nextApplied: Record<string, string> = {};
    for (const slug of kept) if (applied[slug]) nextApplied[slug] = applied[slug];

    await execute(
      "UPDATE products SET badges = ?, hidden_card_badges = ?, badge_applied_at = ? WHERE id = ?",
      [JSON.stringify(kept), JSON.stringify(hidden), JSON.stringify(nextApplied), row.id]
    );
    changed++;
    console.log(`[tag-sweep] ${row.id}: expired ${removed.join(", ")}`);
  }

  return changed;
}

/** Start the periodic sweep. Called once from instrumentation.ts. */
export function startTagSweepScheduler() {
  if (started) return;
  started = true;

  // Run once shortly after boot so a tag that expired while the server was down
  // clears promptly, rather than waiting for the first tick.
  setTimeout(() => {
    sweepExpiredTags()
      .then((n) => { if (n > 0) console.log(`[tag-sweep] startup: cleared expired tags on ${n} product(s)`); })
      .catch((err) => console.error("[tag-sweep] startup failed:", err));
  }, 20_000);

  cron.schedule(SWEEP_CRON, () => {
    sweepExpiredTags()
      .then((n) => { if (n > 0) console.log(`[tag-sweep] cleared expired tags on ${n} product(s)`); })
      .catch((err) => console.error("[tag-sweep] failed:", err));
  });

  console.log(`[tag-sweep] scheduler started (${SWEEP_CRON})`);
}
