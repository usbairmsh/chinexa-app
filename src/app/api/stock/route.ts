import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute, escapeLike } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

interface StockRow extends RowDataPacket {
  id: string; name: string; sku: string; stock_quantity: number; min_stock: number; max_stock: number; price: number;
  category_name: string; is_active: number; image_url: string | null;
}

interface StatsRow extends RowDataPacket { count: number; }
interface SumRow extends RowDataPacket { total: number; }

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
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

    // Count
    const [countResult] = await query<StatsRow[]>(`SELECT COUNT(*) as count FROM products p ${where}`, params);
    const total = countResult?.count || 0;

    // Products with first image + min/max stock
    const products = await query<StockRow[]>(`
      SELECT p.id, p.name, p.sku, p.stock_quantity, p.min_stock, p.max_stock, p.price, p.category_name, p.is_active,
             (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.\`order\` LIMIT 1) as image_url
      FROM products p ${where} ${orderBy} LIMIT ${Math.max(1, Math.min(Math.floor(pageSize), 100))} OFFSET ${Math.max(0, Math.floor((page - 1) * pageSize))}
    `, params);

    // Summary stats — use min_stock/max_stock for thresholds
    const [totalProducts] = await query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1");
    const [outOfStock] = await query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity = 0");
    const [lowStock] = await query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity > 0 AND stock_quantity <= min_stock");
    const [healthyStock] = await query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity > min_stock AND stock_quantity <= max_stock");
    const [overStock] = await query<StatsRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock_quantity > max_stock");
    const [totalUnits] = await query<SumRow[]>("SELECT COALESCE(SUM(stock_quantity), 0) as total FROM products WHERE is_active = 1");
    const [stockValue] = await query<SumRow[]>("SELECT COALESCE(SUM(price * stock_quantity), 0) as total FROM products WHERE is_active = 1");

    return NextResponse.json({
      data: products.map((p) => ({
        id: p.id, name: p.name, sku: p.sku, stock: p.stock_quantity,
        min_stock: p.min_stock || 10, max_stock: p.max_stock || 100,
        price: Number(p.price), category: p.category_name, is_active: !!p.is_active,
        image: p.image_url || `https://picsum.photos/seed/${p.id}/80/80`,
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
    const body = await req.json();

    if (body.updates && Array.isArray(body.updates)) {
      // Bulk update: [{ id, stock }]
      for (const item of body.updates) {
        await execute("UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?", [item.stock, item.id]);
      }
      await logActivity(`Bulk stock update (${body.updates.length} products)`, "stock", undefined, `Updated ${body.updates.length} products`);
      return NextResponse.json({ success: true, updated: body.updates.length });
    }

    if (body.id && body.stock !== undefined) {
      // Single update
      await execute("UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?", [body.stock, body.id]);
      await logActivity(`Updated stock to ${body.stock}`, "stock", body.id, body.name || body.id);
      return NextResponse.json({ success: true });
    }

    if (body.id && body.adjustment !== undefined) {
      // Relative adjustment (+/-)
      await execute("UPDATE products SET stock_quantity = GREATEST(0, stock_quantity + ?), updated_at = NOW() WHERE id = ?", [body.adjustment, body.id]);
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
