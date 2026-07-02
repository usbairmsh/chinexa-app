import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError } from "@/lib/validate";

export const dynamic = "force-dynamic";

let migrated = false;

export async function GET(req: NextRequest) {
  try {
    if (!migrated) {
      try { await execute("ALTER TABLE brands ADD COLUMN show_on_homepage BOOLEAN DEFAULT FALSE", []); } catch {}
      migrated = true;
    }
    const rows = await query<RowDataPacket[]>("SELECT * FROM brands ORDER BY name ASC");
    const showOnHomepage = new URL(req.url).searchParams.get("homepage");
    const filtered = showOnHomepage === "true" ? rows.filter((r) => r.show_on_homepage) : rows;
    return NextResponse.json(filtered.map((r) => ({
      ...r,
      is_active: !!r.is_active,
      show_on_homepage: !!r.show_on_homepage,
      certifications: typeof r.certifications === "string" ? JSON.parse(r.certifications) : r.certifications || [],
    })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validate([
      { field: "name", value: body.name, rules: ["required", "string", { minLength: 2 }], label: "Brand name" },
    ]);
    if (err) return validationError(err);

    const id = `brand-${Date.now()}`;
    const slug = body.slug || body.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

    await execute(
      "INSERT INTO brands (id, name, slug, logo, country, description, website, certifications, is_active, show_on_homepage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.name, slug, body.logo || null, body.country || null, body.description || null, body.website || null, JSON.stringify(body.certifications || []), body.is_active !== false ? 1 : 0, body.show_on_homepage ? 1 : 0]
    );
    await logActivity("Created brand", "brand", id, body.name);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Duplicate entry")) return NextResponse.json({ error: "A brand with this name already exists" }, { status: 409 });
    return NextResponse.json({ error: msg || "Error" }, { status: 500 });
  }
}
