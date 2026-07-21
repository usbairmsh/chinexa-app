import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute, escapeLike } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";
import { ensureInventoryTables, recordStockHistory, handleRestockTransition } from "@/lib/migrate-inventory";

interface StockRow extends RowDataPacket {
  id: string; name: string; sku: string; stock_quantity: number; min_stock: number; max_stock: number; price: number;
  category_name: string; is_active: number; image_url: string | null; last_restocked_at: string | null;
}

interface StatsRow extends RowDataPacket { count: number; }
interface SumRow extends RowDataPacket { total: number; }

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureInventoryTables();
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all"; // all, low, out, overstock
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const sortBy = searchParams.get("sort_by") || "stock_asc";
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("page_size")) || 25;

    let where = "WHERE p.is_active = 1";
    const params: (string | number)[] = [];

    if (filter === "low") { where += " AND p.stock_quantity > 0 AND p.stock_quantity <= p.min_stock"; }
    else if (filter === "out") { where += " AND p.stock_quantity = 0"; }
    else if (filter === "overstock") { where += " AND p.stock_quantity > p.max_stock"; }

    if (search) { where += " AND (p.name LIKE ? OR p.sku LIKE ?)"; const q = `%${escapeLike(search)}%`; params.push(q, q); }
    if (category) { where += " AND p.category_id = ?"; params.push(category); }

    let orderBy = "ORDER BY p.stock_quantity ASC";
    if (sortBy === "stock_desc") orderBy = "ORDER BY p.stock_quantity DESC";
    else if (sortBy === "name_asc") orderBy = "ORDER BY p.name ASC";
    else if (sortBy === "value_desc") orderBy = "ORDER BY (p.price * p.stock_quantity) DESC";

    // All 8 queries are independent of each other (the 6 summary stats are
    // fixed regardless of the page's filter/search) — one round-trip batch
    // instead of 8 sequential ones.
    const [
      [countResult],
      products,
      [totalProducts],
      [outOfStock],
      [lowStock],
      [healthyStock],
      [overStock],
      [totalUnits],
      [stockValue],
    ] = await Promise.all([
      query<StatsRow[]>(`SELECT COUNT(*) as count FROM products p ${where}`, params),
      // First image per product via a pre-aggregated derived table (min `order`,
      // then MIN(url) as a tie-breaker so ties on `order` can't fan out into
      // duplicate product rows) instead of a correlated subquery re-evaluated
      // per product row.
      query<StockRow[]>(`
        SELECT p.id, p.name, p.sku, p.stock_quantity, p.min_stock, p.max_stock, p.price, p.category_name, p.is_active,
               p.last_restocked_at,
               first_img.url as image_url
        FROM products p
        LEFT JOIN (
          SELECT product_id, MIN(url) AS url FROM product_images pi
          WHERE \`order\` = (SELECT MIN(\`order\`) FROM product_images WHERE product_id = pi.product_id)
          GROUP BY product_id
        ) first_img ON first_img.product_id = p.id
        ${where} ${orderBy} LIMIT ${Math.max(1, Math.min(Math.floor(pageSize), 100))} OFFSET ${Math.max(0, Math.floor((page - 1) * pageSize))}
      `, params),
      // Summary stats — use min_stock/max_stock for thresholds
      query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1"),
      query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity = 0"),
      query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity > 0 AND stock_quantity <= min_stock"),
      query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity > min_stock AND stock_quantity <= max_stock"),
      query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity > max_stock"),
      query<SumRow[]>("SELECT COALESCE(SUM(stock_quantity), 0) as total FROM products WHERE is_active = 1"),
      query<SumRow[]>("SELECT COALESCE(SUM(price * stock_quantity), 0) as total FROM products WHERE is_active = 1"),
    ]);
    const total = countResult?.count || 0;

    return NextResponse.json({
      data: products.map((p) => ({
        id: p.id, name: p.name, sku: p.sku, stock: p.stock_quantity,
        min_stock: p.min_stock || 10, max_stock: p.max_stock || 100,
        price: Number(p.price), category: p.category_name, is_active: !!p.is_active,
        image: p.image_url || `https://picsum.photos/seed/${p.id}/80/80`,
        last_restocked_at: p.last_restocked_at || null,
        stock_value: Number(p.price) * p.stock_quantity,
        status: p.stock_quantity === 0 ? "out" : p.stock_quantity <= (p.min_stock || 10) ? "low" : p.stock_quantity > (p.max_stock || 100) ? "over" : "ok",
      })),
      total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize),
      summary: {
        total_products: totalProducts?.count || 0,
        out_of_stock: outOfStock?.count || 0,
        low_stock: lowStock?.count || 0,
        healthy_stock: healthyStock?.count || 0,
        over_stock: overStock?.count || 0,
        total_units: Number(totalUnits?.total || 0),
        total_stock_value: Number(stockValue?.total || 0),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// Bulk or single stock update
export async function PUT(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "stock", "edit");
    if (denied) return denied;
    await ensureInventoryTables();
    const body = await req.json();

    // Small helper: current product-level stock, for before/after diffing.
    const currentStock = async (id: string): Promise<number> => {
      const rows = await query<RowDataPacket[]>("SELECT stock_quantity FROM products WHERE id = ? LIMIT 1", [id]);
      return Number(rows[0]?.stock_quantity ?? 0);
    };

    if (body.updates && Array.isArray(body.updates)) {
      // Bulk update: [{ id, stock }] — wrapped in one transaction so a
      // failure partway through rolls back instead of leaving stock
      // partially updated.
      const befores = new Map<string, number>();
      for (const item of body.updates) befores.set(item.id, await currentStock(item.id));
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const item of body.updates) {
          await conn.execute("UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?", [item.stock, item.id]);
        }
        await conn.commit();
        conn.release();
      } catch (txError) {
        await conn.rollback().catch(() => {});
        conn.release();
        throw txError;
      }
      // History + back-in-stock notifications (outside the transaction, best-effort).
      for (const item of body.updates) {
        const before = befores.get(item.id) ?? 0;
        const after = Number(item.stock);
        const delta = after - before;
        if (delta > 0) {
          await recordStockHistory({ productId: item.id, eventType: "restock", quantityChange: delta, resultingStock: after, note: "Bulk stock update", bumpRestockedAt: true });
        }
        await handleRestockTransition(item.id, before, after);
      }
      await logActivity(`Bulk stock update (${body.updates.length} products)`, "stock", undefined, `Updated ${body.updates.length} products`);
      return NextResponse.json({ success: true, updated: body.updates.length });
    }

    if (body.id && body.stock !== undefined) {
      // Single update
      const before = await currentStock(body.id);
      const after = Number(body.stock);
      await execute("UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?", [after, body.id]);
      const delta = after - before;
      if (delta > 0) {
        await recordStockHistory({ productId: body.id, eventType: "restock", quantityChange: delta, resultingStock: after, note: "Stock updated", bumpRestockedAt: true });
      } else if (delta < 0) {
        await recordStockHistory({ productId: body.id, eventType: "adjust", quantityChange: delta, resultingStock: after, note: "Stock reduced" });
      }
      await handleRestockTransition(body.id, before, after);
      await logActivity(`Updated stock to ${body.stock}`, "stock", body.id, body.name || body.id);
      return NextResponse.json({ success: true });
    }

    if (body.id && body.adjustment !== undefined) {
      // Relative adjustment (+/-)
      const before = await currentStock(body.id);
      await execute("UPDATE products SET stock_quantity = GREATEST(0, stock_quantity + ?), updated_at = NOW() WHERE id = ?", [body.adjustment, body.id]);
      const after = await currentStock(body.id);
      const delta = after - before;
      if (delta > 0) {
        await recordStockHistory({ productId: body.id, eventType: "restock", quantityChange: delta, resultingStock: after, note: "Stock adjustment", bumpRestockedAt: true });
      } else if (delta < 0) {
        await recordStockHistory({ productId: body.id, eventType: "adjust", quantityChange: delta, resultingStock: after, note: "Stock adjustment" });
      }
      await handleRestockTransition(body.id, before, after);
      await logActivity(`Adjusted stock by ${body.adjustment > 0 ? "+" : ""}${body.adjustment}`, "stock", body.id, body.name || body.id);
      return NextResponse.json({ success: true });
    }

    if (body.id && body.price !== undefined) {
      // Price update
      await execute("UPDATE products SET price = ?, updated_at = NOW() WHERE id = ?", [body.price, body.id]);
      await logActivity(`Updated price to ৳${body.price}`, "product", body.id, body.name || body.id);
      return NextResponse.json({ success: true });
    }

    if (body.id && (body.min_stock !== undefined || body.max_stock !== undefined)) {
      // Min/max stock thresholds update
      const fields: string[] = [];
      const vals: (number | string)[] = [];
      if (body.min_stock !== undefined) { fields.push("min_stock = ?"); vals.push(Number(body.min_stock)); }
      if (body.max_stock !== undefined) { fields.push("max_stock = ?"); vals.push(Number(body.max_stock)); }
      vals.push(body.id);
      await execute(`UPDATE products SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`, vals);
      await logActivity(`Updated stock thresholds (min: ${body.min_stock}, max: ${body.max_stock})`, "stock", body.id, body.name || body.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
