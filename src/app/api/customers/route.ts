import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute, escapeLike } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("page_size")) || 20;
    const search = searchParams.get("search");

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (search) { where += " AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)"; const q = `%${escapeLike(search)}%`; params.push(q, q, q); }

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM customers ${where}`, params);
    const total = (countRows[0] as { total: number })?.total || 0;
    const safeLimit = Math.max(1, Math.min(Math.floor(pageSize), 100));
    const safeOffset = Math.max(0, Math.floor((page - 1) * safeLimit));
    const rows = await query<RowDataPacket[]>(`SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`, params);

    // Get total items bought per customer
    const customerIds = rows.map((r) => r.id as string);
    let itemCounts = new Map<string, number>();
    if (customerIds.length > 0) {
      const placeholders = customerIds.map(() => "?").join(",");
      const itemRows = await query<RowDataPacket[]>(
        `SELECT o.customer_id, COALESCE(SUM(oi.quantity), 0) as total_items FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.customer_id IN (${placeholders}) GROUP BY o.customer_id`,
        customerIds
      );
      itemCounts = new Map(itemRows.map((r) => [r.customer_id as string, Number(r.total_items)]));
    }

    return NextResponse.json({ data: rows.map((r) => ({ ...r, is_active: !!r.is_active, total_items: itemCounts.get(r.id as string) || 0 })), total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = `cust-${Date.now()}`;
    await execute(
      "INSERT INTO customers (id, name, email, phone, is_active) VALUES (?, ?, ?, ?, TRUE)",
      [id, body.name, body.email || null, body.phone]
    );
    if (body.address) {
      await execute(
        "INSERT INTO customer_addresses (id, customer_id, label, name, phone, address_line_1, city, district, division, postal_code, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
        [`addr-${id}`, id, body.address.label || "Home", body.name, body.phone, body.address.address_line_1 || "", body.address.city || null, body.address.district || null, body.address.division || null, body.address.postal_code || null]
      );
    }
    await logActivity("Created customer", "customer", id, body.name);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
