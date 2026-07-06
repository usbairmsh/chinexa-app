import { NextResponse } from "next/server";
import { getSmsBalance } from "@/lib/sms";

export async function GET() {
  const result = await getSmsBalance();
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Failed to fetch SMS balance" }, { status: 502 });
  }
  return NextResponse.json({ balance: result.balance });
}
