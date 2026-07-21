// Single source of truth for "is this product buy-as-a-pre-order right now?".
// Reused by the product card, the product detail page, and the order API, so
// the Pre-Order button only ever shows where the backend will actually accept
// a pre-order. Client-safe (no DB/mysql2 imports) so it can be imported from
// both server routes and "use client" components.
//
// The rule (COD-only reservations): a product is pre-orderable when it's out of
// stock AND carries the `preorder` badge AND the store's `preorders` feature
// toggle is on. The optional preorder_release_date only tunes the "expected"
// date shown to the customer — it does not decide pre-orderability.

type BadgeLike = string;

interface PreorderableProduct {
  stock_quantity?: number | null;
  badges?: BadgeLike[] | string | null;
}

/** Normalizes the badges field (JSON string, array, or null) to a string[]. */
function badgeList(badges: PreorderableProduct["badges"]): string[] {
  if (Array.isArray(badges)) return badges as string[];
  if (typeof badges === "string") {
    try {
      const parsed = JSON.parse(badges);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function hasPreorderBadge(product: PreorderableProduct): boolean {
  return badgeList(product.badges).includes("preorder");
}

/**
 * Whether the given product/selection can be pre-ordered right now.
 * @param stockForSelection stock of the currently selected variant (or the
 *   product's own stock when there are no variants). Pass 0 for out of stock.
 * @param featureEnabled the store's `preorders` feature toggle.
 */
export function isPreorderable(
  product: PreorderableProduct,
  stockForSelection: number,
  featureEnabled: boolean
): boolean {
  return featureEnabled && stockForSelection === 0 && hasPreorderBadge(product);
}
