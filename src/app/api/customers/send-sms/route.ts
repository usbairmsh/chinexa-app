import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { sendSms } from "@/lib/sms";

// POST /api/customers/send-sms — bulk/single SMS to selected customers
// Body: { customer_ids: string[], message: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const customerIds: string[] = Array.isArray(body.customer_ids) ? body.customer_ids : [];
    const message: string = (body.message || "").trim();

    if (customerIds.length === 0) return NextResponse.json({ error: "Select at least one customer" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const placeholders = customerIds.map(() => "?").join(",");
    const rows = await query<RowDataPacket[]>(
      `SELECT id, name, phone FROM customers WHERE id IN (${placeholders})`,
      customerIds
    );

    const results = await Promise.all(
      rows.map(async (r) => {
        const result = await sendSms(r.phone as string, message);
        return { id: r.id as string, phone: r.phone as string, ...result };
      })
    );

    const sent = results.filter((r) => r.success).length;
    const failed = results.length - sent;

    await logActivity("Sent bulk SMS", "customer", undefined, `${sent}/${rows.length} recipients`);

    return NextResponse.json({
      total: rows.length,
      sent,
      failed,
      results: results.map((r) => ({ id: r.id, phone: r.phone, success: r.success, error: r.error })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
