import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { requirePermission } from "@/lib/admin-permissions-server";
import { getReturnConfig, DEFAULT_RETURN_CONFIG, type ReturnReason } from "@/lib/return-config";
import { publicServerError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";

// GET — current return config (reasons + window). Public read is also available
// via /api/settings?key=return_config; this returns the coerced/seeded shape.
export async function GET() {
  try {
    return NextResponse.json(await getReturnConfig());
  } catch (error: unknown) {
    return publicServerError("GET /api/returns/config", error);
  }
}

// PUT — admin updates reasons + window. Gated by the Returns permission (not
// generic settings), so returns staff can manage it without settings access.
export async function PUT(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "returns", "approve");
    if (denied) return denied;

    const body = await req.json();
    const reasons: ReturnReason[] = Array.isArray(body.reasons)
      ? body.reasons
          .map((r: Record<string, unknown>) => ({
            code: String(r.code || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            label: String(r.label || "").trim(),
            enabled: r.enabled !== false,
          }))
          .filter((r: ReturnReason) => r.code && r.label)
      : DEFAULT_RETURN_CONFIG.reasons;
    if (reasons.length === 0) {
      return NextResponse.json({ error: "At least one return reason is required" }, { status: 400 });
    }
    const windowDays = Math.max(1, Math.floor(Number(body.windowDays) || 7));

    const value = JSON.stringify({ reasons, windowDays });
    await execute(
      "INSERT INTO settings (`key`, value) VALUES ('return_config', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [value]
    );
    await logActivity("Updated return config", "settings", "return_config");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("PUT /api/returns/config", error);
  }
}
