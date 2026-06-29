import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

interface TableRow extends RowDataPacket {
  Tables_in_chinexa: string;
}

export async function GET() {
  try {
    await query("SELECT 1 AS connected");
    const tables = await query<TableRow[]>("SHOW TABLES");
    return NextResponse.json({
      status: "connected",
      database: "chinexa",
      tables: tables.map((t) => t.Tables_in_chinexa),
      tableCount: tables.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
