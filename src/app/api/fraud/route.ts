import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

interface FraudRow extends RowDataPacket { [key: string]: unknown; }

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<FraudRow[]>(
      "SELECT * FROM fraud_alerts ORDER BY created_at DESC"
    );

    const stats = {
      flagged: rows.filter((r) => r.status === "flagged").length,
      reviewed: rows.filter((r) => r.status === "reviewed").length,
      cleared: rows.filter((r) => r.status === "cleared").length,
      blocked: rows.filter((r) => r.status === "blocked").length,
      total: rows.length,
    };

    return NextResponse.json({ data: rows, stats });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, reviewed_by, notes } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    await execute(
      "UPDATE fraud_alerts SET status = ?, reviewed_by = ?, notes = ?, updated_at = NOW() WHERE id = ?",
      [status, reviewed_by || null, notes || null, id]
    );
    await logActivity(`Fraud alert ${status}`, "fraud", id, notes || undefined);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
