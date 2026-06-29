import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

// Normalize Bangladesh phone: "01712345678" → "+88017..."
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

// POST /api/auth — Login: look up customer by phone
// POST /api/auth — Register: create new customer with phone + name
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ─── LOGIN: Look up customer by phone ───
    if (action === "login") {
      const rawPhone = (body.phone || "").trim();
      if (!rawPhone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      const phone = normalizePhone(rawPhone);

      const rows = await query<RowDataPacket[]>(
        "SELECT id, name, email, phone, avatar, is_active FROM customers WHERE phone = ? OR phone = ? LIMIT 1",
        [phone, rawPhone]
      );

      if (rows.length === 0) {
        return NextResponse.json({ found: false, phone }, { status: 200 });
      }

      const customer = rows[0];
      return NextResponse.json({
        found: true,
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.email || undefined,
          phone: customer.phone,
          avatar: customer.avatar || undefined,
          role: "customer" as const,
        },
      });
    }

    // ─── REGISTER: Create new customer ───
    if (action === "register") {
      const rawPhone = (body.phone || "").trim();
      const phone = normalizePhone(rawPhone);
      const name = (body.name || "").trim();

      if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

      // Check if already exists
      const existing = await query<RowDataPacket[]>("SELECT id, name FROM customers WHERE phone = ? OR phone = ? LIMIT 1", [phone, rawPhone]);
      if (existing.length > 0) {
        return NextResponse.json({
          success: true,
          user: {
            id: existing[0].id,
            name: existing[0].name,
            phone,
            role: "customer" as const,
          },
          message: "Account already exists",
        });
      }

      const id = `cust-${Date.now()}`;
      await execute(
        "INSERT INTO customers (id, name, email, phone, is_active) VALUES (?, ?, ?, ?, TRUE)",
        [id, name, body.email || null, phone]
      );

      // Optional address
      if (body.address_line_1) {
        await execute(
          "INSERT INTO customer_addresses (id, customer_id, label, name, phone, address_line_1, city, district, division, postal_code, is_default) VALUES (?, ?, 'Home', ?, ?, ?, ?, ?, ?, ?, TRUE)",
          [`addr-${id}`, id, name, phone, body.address_line_1, body.city || null, body.district || null, body.division || null, body.postal_code || null]
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id,
          name,
          email: body.email || undefined,
          phone,
          role: "customer" as const,
        },
      }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    // Duplicate phone
    if (message.includes("Duplicate entry")) {
      return NextResponse.json({ error: "This phone number is already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
