import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

interface BrandRow extends RowDataPacket {
  id: string; name: string; slug: string; logo: string | null; country: string | null;
  description: string | null; website: string | null; certifications: string | string[] | null;
  is_active: number;
}

export interface Brand {
  id: string; name: string; slug: string; logo?: string; country?: string;
  description?: string; website?: string; certifications: string[]; is_active: boolean;
}

// Direct-DB counterpart to GET /api/brands/[id] — used for server-side
// prefetch (brands/[slug]/layout.tsx) so the same-shaped object lands in the
// React Query cache under the ["brand", slug] key useBrand() reads from,
// same reasoning as getProductBySlugOrId for the product detail page.
export async function getBrandBySlug(slugOrId: string): Promise<Brand | null> {
  const rows = await query<BrandRow[]>("SELECT * FROM brands WHERE slug = ? OR id = ? LIMIT 1", [slugOrId, slugOrId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id, name: r.name, slug: r.slug,
    logo: r.logo || undefined, country: r.country || undefined,
    description: r.description || undefined, website: r.website || undefined,
    certifications: typeof r.certifications === "string" ? JSON.parse(r.certifications) : r.certifications || [],
    is_active: !!r.is_active,
  };
}
