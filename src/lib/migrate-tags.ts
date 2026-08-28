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

    done = true;
  } catch (err) {
    // Leave done=false so a transient failure retries on the next request.
    console.error("[ensureTagTables] migration failed:", err);
  }
}
