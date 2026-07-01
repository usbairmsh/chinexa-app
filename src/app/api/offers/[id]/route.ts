import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ title: "title", description: "description", applicability: "applicability", discount: "discount", start_date: "start_date", end_date: "end_date" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.applicable_ids !== undefined) {
      fields.push("applicable_ids = ?");
      values.push(JSON.stringify(body.applicable_ids));
    }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
    values.push(id);
    await execute(`UPDATE offers SET ${fields.join(", ")} WHERE id = ?`, values);
    await logActivity("Updated offer", "offer", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await execute("DELETE FROM offers WHERE id = ?", [id]);
    await logActivity("Deleted offer", "offer", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
