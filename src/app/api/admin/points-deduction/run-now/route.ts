import { NextResponse } from "next/server";
import { runPointsDeductionEngine } from "@/lib/points-deduction-engine";

export const dynamic = "force-dynamic";

// POST /api/admin/points-deduction/run-now — lets an admin trigger a rule
// evaluation immediately from the admin UI, instead of waiting for the next
// cron tick, to see the effect of a rule right after saving it.
//
// Note: like every other /api/admin/* route in this codebase, this has no
// server-side session check — the admin panel's client-side layout is what
// gates access today, not the API layer itself. Anyone who can reach this
// URL directly can trigger a real run. This matches the existing codebase
// convention rather than introducing new risk, but is worth real
// authentication (e.g. a checked admin session cookie) before this app
// handles anything more sensitive than it already does.
export async function POST() {
  try {
    const summary = await runPointsDeductionEngine();
    return NextResponse.json({ success: true, ...summary });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
