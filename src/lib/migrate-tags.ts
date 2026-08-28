import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// ─── Configurable product tags ────────────────────────────────────────────────
// Product "badges" used to be a hardcoded union of seven strings, duplicated in
// the type, the CVA class map, and both admin product pages. This table makes
// them data: an admin can pick each tag's colour, attach it to a category /
// subcategory / product / offer / coupon, and give an unattached tag a validity
// period.
//
// What is NOT changing: a product still stores its tags as a JSON array of
// SLUGS in `products.badges`. Every existing section, filter and the pre-order
// logic keys off a slug being present in that array, so they keep working
// untouched. This table only describes what a slug LOOKS like and how it
// behaves — it is not a join table.
//
// Idempotent + self-healing like the other migrate-*.ts helpers.

/**
 * The seven original badges. They are seeded as `is_system` rows: an admin can
 * recolour and relabel them, but the slug is frozen and they cannot be deleted,
 * because each one is load-bearing somewhere in the app:
 *
 *   preorder    → drives deposit / online-payment-only rules in lib/preorder.ts
 *   new         → /collections/new-arrivals + homepage section
 *   bestseller  → /collections/bestsellers + homepage section
 *   trending    → /collections/trending + homepage section
 *   exclusive   → /exclusive
 *   sale        → display only today, but shoppers recognise it
 *   limited     → display only today
 *
 * Deleting or renaming one of these would silently empty a storefront page or
 * break checkout behaviour, which is why they are protected.
 *
 * Colours are the literal hex values the old CVA variants resolved to, so
 * seeding changes nothing visually on an existing store. `priority` seeds in
 * the order the badges were previously listed in the admin UI.
 */
export const SYSTEM_TAGS: { slug: string; label: string; color: string; priority: number }[] = [
  { slug: "new", label: "New", color: "#0F9D58", priority: 10 },
  { slug: "sale", label: "Sale", color: "#DC2626", priority: 20 },
  { slug: "bestseller", label: "Bestseller", color: "#B8860B", priority: 30 },
  { slug: "preorder", label: "Pre-Order", color: "#7C3AED", priority: 40 },
  { slug: "limited", label: "Limited", color: "#E11D48", priority: 50 },
  { slug: "trending", label: "Trending", color: "#2563EB", priority: 60 },
  { slug: "exclusive", label: "Exclusive", color: "#B8860B", priority: 70 },
];

let done = false;

export async function ensureTagTables() {
  if (done) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS tags (
        id VARCHAR(50) PRIMARY KEY,
        -- What actually gets stored in products.badges. Immutable for system
        -- tags; UNIQUE so two tags can never fight over the same slug.
        slug VARCHAR(60) NOT NULL UNIQUE,
        label VARCHAR(80) NOT NULL,
        -- #RRGGBB from the colour picker. Product tags sit on top of product
        -- photography, so this is used as a SOLID background, never an alpha
        -- tint (a tint let the image bleed through and washed the label out).
        color VARCHAR(7) NOT NULL DEFAULT '#7C3AED',
        -- NULL = pick black or white automatically by contrast against color.
        text_color VARCHAR(7) NULL DEFAULT NULL,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        -- Attachment. 'none' = free-floating, which is the ONLY case where a
        -- validity period is allowed (see the invariant in lib/tags.ts).
        -- Mirrors the applicability/applicable_ids shape already used by offers.
        attach_type ENUM('none','category','subcategory','product','offer','coupon')
          NOT NULL DEFAULT 'none',
        attach_ids JSON NULL DEFAULT NULL,
        -- Validity runs from the date the tag was applied TO A GIVEN PRODUCT,
        -- not from any date on the tag itself — so the deadline is per-product
        -- and lives in products.badge_applied_at. 'date' stores an absolute
        -- YYYY-MM-DD; the others store a count in validity_value.
        validity_mode ENUM('none','date','days','months','years')
          NOT NULL DEFAULT 'none',
        validity_value VARCHAR(20) NULL DEFAULT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        -- Lower sorts first. Decides WHICH tags win when a product carries more
        -- than the three a product card can show.
        priority INT NOT NULL DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tags_active_priority (is_active, priority)
      ) ENGINE=InnoDB
    `);

    // Per-product application timestamps: {"flash-sale":"2026-08-28T10:00:00Z"}.
    // Written when a slug FIRST appears in a product's badges, cleared when it
    // is removed. This is what makes "validity counted from the date I added
    // the tag to the product" possible — the same tag can expire on different
    // days for different products.
    const cols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products'
       AND column_name = 'badge_applied_at'`
    );
    if (cols.length === 0) {
      await execute("ALTER TABLE products ADD COLUMN badge_applied_at JSON NULL DEFAULT NULL");
    }

    // Seed the built-ins. INSERT IGNORE (not REPLACE) so an admin's own colour,
    // label and priority survive every subsequent boot — this must never stomp
    // customisation.
    for (const t of SYSTEM_TAGS) {
      await execute(
        `INSERT IGNORE INTO tags (id, slug, label, color, is_system, priority)
         VALUES (?, ?, ?, ?, TRUE, ?)`,
        [`tag-${t.slug}`, t.slug, t.label, t.color, t.priority]
      );
    }

    // Repair pass for stores seeded before is_system existed: a built-in slug
    // must always be protected, even if it was somehow created as a normal tag.
    await execute(
      `UPDATE tags SET is_system = TRUE WHERE slug IN (${SYSTEM_TAGS.map(() => "?").join(",")})`,
      SYSTEM_TAGS.map((t) => t.slug)
    );

    // ─── Adopt badges already on live products ───────────────────────────────
    // Until now nothing validated products.badges — the API stored whatever it
    // was sent — so a deployed store can hold slugs beyond the seven built-ins.
    // Those products are already live and their labels must keep rendering, so
    // every distinct slug found on a product gets a tags row if it has none.
    //
    // Adopted tags are NOT marked is_system: they are fully editable and
    // deletable, unlike the seven the storefront depends on.
    await adoptExistingBadges();

    done = true;
  } catch (err) {
    // Leave done=false so a transient failure retries on the next request.
    console.error("[ensureTagTables] migration failed:", err);
  }
}

/**
 * Give every badge slug already present on a product a `tags` row, so nothing
 * that renders on the live site disappears when tags become configurable.
 *
 * Runs on every boot, not just the first: a slug could also arrive from a
 * database restore or a direct SQL edit, and adopting it late is much better
 * than dropping a label a shopper can see.
 *
 * Colour is derived from the slug rather than random, so the same name always
 * gets the same colour and an admin can recolour it afterwards.
 */
async function adoptExistingBadges(): Promise<void> {
  // JSON_TABLE would be tidier but needs MySQL 8.0.4+; this works everywhere
  // and the product count here is small enough that it costs nothing.
  const rows = await query<RowDataPacket[]>(
    "SELECT DISTINCT badges FROM products WHERE badges IS NOT NULL AND JSON_LENGTH(badges) > 0"
  );

  const found = new Set<string>();
  for (const row of rows) {
    let list: unknown;
    try {
      list = typeof row.badges === "string" ? JSON.parse(row.badges) : row.badges;
    } catch {
      continue; // unparseable JSON — skip rather than abort the whole migration
    }
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const slug = String(raw ?? "").trim();
      // Only adopt slugs that are storable. Anything malformed is left alone:
      // inventing a tag for it would legitimise bad data.
      if (slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 60) found.add(slug);
    }
  }
  if (found.size === 0) return;

  const existing = await query<RowDataPacket[]>(
    `SELECT slug FROM tags WHERE slug IN (${[...found].map(() => "?").join(",")})`,
    [...found]
  );
  const known = new Set(existing.map((r) => String(r.slug)));
  const missing = [...found].filter((s) => !known.has(s));
  if (missing.length === 0) return;

  for (const slug of missing) {
    await execute(
      `INSERT IGNORE INTO tags (id, slug, label, color, is_system, priority)
       VALUES (?, ?, ?, ?, FALSE, ?)`,
      // Adopted tags sort after the built-ins, so they can't displace an
      // existing tag from a product card's top three on day one.
      [`tag-${slug}`, slug, titleCase(slug), colorForSlug(slug), 500]
    );
  }
  console.log(`[ensureTagTables] adopted ${missing.length} existing badge(s): ${missing.join(", ")}`);
}

/** "flash-sale" → "Flash Sale" */
function titleCase(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").slice(0, 80);
}

/**
 * Deterministic colour from a slug: the same name always yields the same
 * colour, so an adopted tag looks stable rather than randomly reskinned on
 * each deploy. Drawn from the same palette the configurator offers as swatches.
 */
function colorForSlug(slug: string): string {
  const palette = ["#0F9D58", "#DC2626", "#B8860B", "#7C3AED", "#E11D48", "#2563EB", "#0891B2", "#EA580C", "#4B5563", "#DB2777"];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
