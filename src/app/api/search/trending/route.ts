import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureSearchIndexes } from "@/lib/migrate-search";

export const dynamic = "force-dynamic";

interface TrendingRow extends RowDataPacket {
  term: string;
  searches: number;
}

// Real trending searches from the last 14 days of actual customer search
// activity, grouped case-insensitively. Falls back to top-selling product
// names if there's not enough search history yet (e.g. a fresh install).
export async function GET() {
  try {
    await ensureSearchIndexes();

    const rows = await query<TrendingRow[]>(
      `SELECT LOWER(term) AS term, COUNT(*) AS searches
       FROM search_logs
       WHERE created_at > (NOW() - INTERVAL 14 DAY) AND result_count > 0
       GROUP BY LOWER(term)
       ORDER BY searches DESC, MAX(created_at) DESC
       LIMIT 6`
    );

    if (rows.length >= 4) {
      return NextResponse.json({ terms: rows.map((r) => r.term), source: "search_activity" });
    }

    // Not enough real search history yet — fall back to top-selling products
    // as a reasonable stand-in for "trending", rather than a hardcoded list.
    // Sold-quantity pre-aggregated via a derived table instead of a
    // correlated subquery re-evaluated per product row.
    const fallback = await query<RowDataPacket[]>(
      `SELECT p.name FROM products p
       LEFT JOIN (SELECT product_id, SUM(quantity) AS qty FROM order_items GROUP BY product_id) oi_agg ON oi_agg.product_id = p.id
       WHERE p.is_active = 1
       ORDER BY COALESCE(oi_agg.qty, 0) DESC, p.is_featured DESC, p.created_at DESC
       LIMIT 6`
    );

    return NextResponse.json({ terms: fallback.map((r) => r.name as string), source: "bestsellers" });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
