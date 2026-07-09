import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { notifyAdmin } from "@/lib/notify";

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

// POST /api/auth
//   action: "login"          — phone + password
//   action: "check_phone"    — look up whether a phone is registered (used by register/forgot-password before sending OTP)
//   action: "register"       — create new customer with phone + name + birthdate + password (call after OTP verified)
//   action: "reset_password" — set a new password (call after OTP verified)
//   action: "deactivate" / "reactivate"
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ─── LOGIN: phone + password ───
    if (action === "login") {
      const rawPhone = (body.phone || "").trim();
      const password = body.password || "";
      if (!rawPhone || !password) {
        return NextResponse.json({ error: "Phone number and password are required" }, { status: 400 });
      }
      const phone = normalizePhone(rawPhone);

      const rows = await query<RowDataPacket[]>(
        "SELECT id, name, email, phone, avatar, password, is_active FROM customers WHERE phone = ? OR phone = ? LIMIT 1",
        [phone, rawPhone]
      );

      if (rows.length === 0) {
        return NextResponse.json({ error: "Invalid phone number or password" }, { status: 401 });
      }

      const customer = rows[0];

      if (!customer.is_active) {
        return NextResponse.json({
          blocked: true,
          error: "This account has been deactivated. Please contact support if you believe this is a mistake.",
        }, { status: 403 });
      }

      if (!customer.password) {
        // Pre-password-era account — cannot log in until they reset via forgot-password
        return NextResponse.json({ error: "Please reset your password to continue using this account." }, { status: 401 });
      }

      const valid = await bcrypt.compare(password, customer.password as string);
      if (!valid) {
        return NextResponse.json({ error: "Invalid phone number or password" }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
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

    // ─── CHECK PHONE: does this phone belong to an existing account? ───
    // Used by register (to stop duplicate signups) and forgot-password
    // (to avoid sending OTP SMS to numbers with no account).
    if (action === "check_phone") {
      const rawPhone = (body.phone || "").trim();
      if (!rawPhone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      const phone = normalizePhone(rawPhone);

      const rows = await query<RowDataPacket[]>(
        "SELECT id, name, is_active, account_type FROM customers WHERE phone = ? OR phone = ? LIMIT 1",
        [phone, rawPhone]
      );

      if (rows.length === 0) return NextResponse.json({ found: false, phone });

      if (!rows[0].is_active) {
        return NextResponse.json({
          found: true,
          blocked: true,
          error: "This account has been deactivated. Please contact support if you believe this is a mistake.",
        }, { status: 403 });
      }

      // A temporary account (auto-created from a guest checkout with this
      // phone) has no password yet — it's not "registered" in any real
      // sense, so registration should be allowed to proceed and claim it.
      if (rows[0].account_type === "temporary") {
        return NextResponse.json({ found: false, temporary: true, phone });
      }

      return NextResponse.json({ found: true, name: rows[0].name });
    }

    // ─── REGISTER: create new customer (call after OTP has been verified) ───
    if (action === "register") {
      const rawPhone = (body.phone || "").trim();
      const phone = normalizePhone(rawPhone);
      const name = (body.name || "").trim();
      const birthdate = (body.birthdate || "").trim();
      const password = body.password || "";

      if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if (!birthdate) return NextResponse.json({ error: "Birthdate is required" }, { status: 400 });
      if (!password || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      // Check if already exists (active or inactive)
      const existing = await query<RowDataPacket[]>(
        "SELECT id, name, email, account_type, is_active FROM customers WHERE phone = ? OR phone = ? LIMIT 1",
        [phone, rawPhone]
      );

      if (existing.length > 0) {
        const existingCustomer = existing[0];
        if (!existingCustomer.is_active) {
          return NextResponse.json({
            error: "This phone number belongs to a deactivated account. Please contact support to reactivate.",
          }, { status: 403 });
        }

        if (existingCustomer.account_type !== "temporary") {
          return NextResponse.json({ error: "This phone number is already registered. Please log in instead." }, { status: 409 });
        }

        // Temporary account (auto-created from a guest checkout with this
        // phone) — claim it in place rather than reject or duplicate, so the
        // customer's existing orders/addresses (linked via customer_id) carry
        // over automatically instead of being orphaned under a brand-new id.
        const hashed = await bcrypt.hash(password, 10);
        const id = existingCustomer.id as string;
        await execute(
          "UPDATE customers SET name = ?, email = COALESCE(email, ?), password = ?, birthdate = ?, account_type = 'registered' WHERE id = ?",
          [name, body.email || null, hashed, birthdate, id]
        );
        await logActivity("Temporary customer claimed account via registration", "customer", id, phone);
        await notifyAdmin("customer", `Returning customer registered: ${name}`, `${phone} claimed their account (previously a guest checkout).`, "/admin/customers");

        if (body.address_line_1) {
          await execute(
            "INSERT INTO customer_addresses (id, customer_id, label, name, phone, address_line_1, city, district, division, postal_code, is_default) VALUES (?, ?, 'Home', ?, ?, ?, ?, ?, ?, ?, TRUE)",
            [`addr-${Date.now()}`, id, name, phone, body.address_line_1, body.city || null, body.district || null, body.division || null, body.postal_code || null]
          );
        }

        return NextResponse.json({
          success: true,
          user: {
            id,
            name,
            email: (existingCustomer.email as string) || body.email || undefined,
            phone,
            role: "customer" as const,
          },
        }, { status: 200 });
      }

      const hashed = await bcrypt.hash(password, 10);
      const id = `cust-${Date.now()}`;
      await execute(
        "INSERT INTO customers (id, name, email, phone, password, birthdate, is_active, account_type) VALUES (?, ?, ?, ?, ?, ?, TRUE, 'registered')",
        [id, name, body.email || null, phone, hashed, birthdate]
      );

      // Alert admin about the new registration
      await notifyAdmin("customer", `New customer: ${name}`, `${phone} just created an account.`, "/admin/customers");

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

    // ─── RESET PASSWORD: set a new password (call after OTP has been verified) ───
    if (action === "reset_password") {
      const rawPhone = (body.phone || "").trim();
      const phone = normalizePhone(rawPhone);
      const password = body.password || "";

      if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
      if (!password || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      const rows = await query<RowDataPacket[]>(
        "SELECT id, is_active FROM customers WHERE phone = ? OR phone = ? LIMIT 1",
        [phone, rawPhone]
      );
      if (rows.length === 0) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      if (!rows[0].is_active) {
        return NextResponse.json({ error: "This account has been deactivated. Please contact support." }, { status: 403 });
      }

      const hashed = await bcrypt.hash(password, 10);
      // Setting a real password is what makes an account "registered" — this
      // also upgrades a guest/temporary customer (auto-created at checkout)
      // the first time they claim their account via forgot-password.
      await execute("UPDATE customers SET password = ?, account_type = 'registered' WHERE id = ?", [hashed, rows[0].id as string]);
      await logActivity("Customer reset password", "customer", rows[0].id as string);

      return NextResponse.json({ success: true });
    }

    // ─── CHANGE PASSWORD: self-service from profile page (requires current password) ───
    if (action === "change_password") {
      const { customer_id, current_password, new_password } = body;
      if (!customer_id || !current_password || !new_password) {
        return NextResponse.json({ error: "All fields are required" }, { status: 400 });
      }
      if (new_password.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
      }

      const rows = await query<RowDataPacket[]>("SELECT password FROM customers WHERE id = ?", [customer_id]);
      if (rows.length === 0) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      if (!rows[0].password) {
        return NextResponse.json({ error: "No password set on this account yet. Use Forgot Password instead." }, { status: 400 });
      }

      const valid = await bcrypt.compare(current_password, rows[0].password as string);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

      const hashed = await bcrypt.hash(new_password, 10);
      await execute("UPDATE customers SET password = ? WHERE id = ?", [hashed, customer_id]);
      await logActivity("Customer changed password", "customer", customer_id);

      return NextResponse.json({ success: true });
    }

    // ─── DEACTIVATE: soft-delete customer account ───
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
    if (message.includes("Duplicate entry")) {
      return NextResponse.json({ error: "This phone number is already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
