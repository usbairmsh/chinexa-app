import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

// Normalize Bangladesh phone: "01712345678" → "+8801712345678"
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("+88") && !cleaned.startsWith("+880")) return `+880${cleaned.slice(3)}`;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("88") && cleaned.length === 13) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 11) return `+88${cleaned}`;
  return cleaned;
}

// POST /api/auth — Login: look up customer by phone
// POST /api/auth — Register: create new customer with phone + name
// POST /api/auth — Deactivate: soft-delete customer account
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

      // Block inactive/deactivated accounts
      if (!customer.is_active) {
        return NextResponse.json({
          found: true,
          blocked: true,
          error: "This account has been deactivated. Please contact support if you believe this is a mistake.",
        }, { status: 403 });
      }

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

      // Check if already exists (active or inactive)
      const existing = await query<RowDataPacket[]>(
        "SELECT id, name, is_active FROM customers WHERE phone = ? OR phone = ? LIMIT 1",
        [phone, rawPhone]
      );

      if (existing.length > 0) {
        // If the account is deactivated, block registration
        if (!existing[0].is_active) {
          return NextResponse.json({
            error: "This phone number belongs to a deactivated account. Please contact support to reactivate.",
          }, { status: 403 });
        }
        // Active account exists — return it
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

    // ─── DEACTIVATE: Soft-delete customer account ───
    if (action === "deactivate") {
      const { customer_id, reason } = body;
      if (!customer_id) return NextResponse.json({ error: "customer_id is required" }, { status: 400 });

      await execute(
        "UPDATE customers SET is_active = FALSE, deactivated_at = NOW(), deactivation_reason = ? WHERE id = ?",
        [reason || "Customer requested account deletion", customer_id]
      );
      await logActivity("Customer account deactivated", "customer", customer_id, reason || "Customer requested");

      return NextResponse.json({ success: true });
    }

    // ─── REACTIVATE: Admin can reactivate an account ───
    if (action === "reactivate") {
      const { customer_id } = body;
      if (!customer_id) return NextResponse.json({ error: "customer_id is required" }, { status: 400 });

      await execute(
        "UPDATE customers SET is_active = TRUE, deactivated_at = NULL, deactivation_reason = NULL WHERE id = ?",
        [customer_id]
      );
      await logActivity("Customer account reactivated", "customer", customer_id);

      return NextResponse.json({ success: true });
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
