import { NextRequest, NextResponse } from "next/server";
import { runPointsDeductionEngine } from "@/lib/points-deduction-engine";

export const dynamic = "force-dynamic";

// POST /api/cron/points-deduction — triggered by an external OS-level cron on
// the server (this app has no in-process scheduler). Auth via a bearer secret
// rather than a query param, since query strings land in reverse-proxy access
// logs in plaintext by default.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runPointsDeductionEngine();
    console.log(`[points-deduction cron] evaluated ${summary.rulesEvaluated} rules, deducted ${summary.totalPointsDeducted} points across ${summary.customersAffected} customers`);
    return NextResponse.json({ success: true, ...summary });
  } catch (error: unknown) {
    console.error("[points-deduction cron] run failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
