import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { publicServerError } from "@/lib/validate";
import { ensureReviewColumns } from "@/lib/migrate-reviews";
import { getVerifiedCustomerId } from "@/lib/customer-session";
import { getVerifiedAdminId } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

// Owner-or-admin guard for the [id] path param (the customer).
function authorizeOwnerOrAdmin(req: NextRequest, pathId: string): NextResponse | null {
  if (getVerifiedAdminId(req)) return null;
  const sessionId = getVerifiedCustomerId(req);
  if (!sessionId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (sessionId !== pathId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  return null;
}

// GET /api/customers/[id]/pending-reviews — every product from this
// customer's delivered ('received') orders that they have not yet reviewed.
// Powers the "My Reviews" account page's pending-review count/list.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureReviewColumns();
    const { id } = await params;
    const denied = authorizeOwnerOrAdmin(req, id);
    if (denied) return denied;

    const rows = await query<RowDataPacket[]>(
      `SELECT oi.product_id, oi.product_name, oi.product_image, oi.product_slug,
              MAX(o.id) AS order_id, MAX(o.order_number) AS order_number, MAX(o.created_at) AS ordered_at
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.customer_id = ?
         AND o.status = 'received'
         AND oi.product_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM reviews r WHERE r.customer_id = o.customer_id AND r.product_id = oi.product_id
         )
       GROUP BY oi.product_id, oi.product_name, oi.product_image, oi.product_slug
       ORDER BY ordered_at DESC`,
      [id]
    );

    return NextResponse.json({
      count: rows.length,
      items: rows.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        product_image: r.product_image,
        product_slug: r.product_slug,
        order_id: r.order_id,
        order_number: r.order_number,
        ordered_at: r.ordered_at,
      })),
    });
  } catch (error: unknown) {
    return publicServerError("GET /api/customers/[id]/pending-reviews", error);
  }
}
