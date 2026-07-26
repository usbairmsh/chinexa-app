"use client";

import { useState, useCallback } from "react";
import { useCartStore } from "@/stores/cart.store";
import { useUIStore } from "@/stores/ui.store";
import type { Product } from "@/types/product";

export interface ReorderLine {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface ReorderResult {
  added: number;        // lines successfully added
  unavailable: number;  // lines skipped (deleted, inactive, out of stock, variant gone)
  mixed: boolean;       // at least one line rejected due to preorder/in-stock cart conflict
}

// Re-adds a past order's lines to the cart. Order items are historical
// snapshots (old price, no current stock, product/variant may be gone), so we
// re-fetch CURRENT product data via /api/products?ids= and rebuild valid cart
// items — correct price, current stock clamp, fresh slug/image — skipping
// anything no longer buyable. Returns a summary the caller can surface.
export function useReorder() {
  const addItem = useCartStore((s) => s.addItem);
  const setCartDrawerOpen = useUIStore((s) => s.setCartDrawerOpen);
  const [reordering, setReordering] = useState(false);

  const reorder = useCallback(async (lines: ReorderLine[]): Promise<ReorderResult> => {
    const result: ReorderResult = { added: 0, unavailable: 0, mixed: false };
    const valid = lines.filter((l) => l.product_id);
    if (valid.length === 0) return result;

    setReordering(true);
    try {
      const ids = Array.from(new Set(valid.map((l) => l.product_id)));
      let products: Product[] = [];
      try {
        const res = await fetch(`/api/products?ids=${ids.map(encodeURIComponent).join(",")}`);
        const json = res.ok ? await res.json() : { data: [] };
        products = Array.isArray(json.data) ? json.data : [];
      } catch {
        products = [];
      }
      const byId = new Map(products.map((p) => [p.id, p]));

      for (const line of valid) {
        const product = byId.get(line.product_id);
        // Gone or deactivated → unavailable.
        if (!product || product.is_active === false) { result.unavailable++; continue; }

        // Resolve the variant if the line had one; a discontinued variant → skip.
        const variant = line.variant_id
          ? product.variants.find((v) => v.id === line.variant_id)
          : undefined;
        if (line.variant_id && !variant) { result.unavailable++; continue; }

        const stock = variant ? variant.stock : product.stock_quantity;
        if (stock <= 0) { result.unavailable++; continue; } // out of stock → skip (reorder is for in-stock re-buys)

        const price = product.price + (variant?.price_adjustment || 0);
        const comparePrice = product.compare_at_price != null
          ? product.compare_at_price + (variant?.price_adjustment || 0)
          : undefined;

        const outcome = addItem({
          id: "",
          product_id: product.id,
          product_name: product.name,
          product_slug: product.slug,
          product_image: product.images[0]?.url || "",
          variant_id: variant?.id,
          variant_name: variant?.name,
          price,
          compare_at_price: comparePrice,
          quantity: Math.max(1, Math.min(line.quantity || 1, stock)),
          stock,
        });
        if (outcome === "mixed") { result.mixed = true; continue; }
        result.added++;
      }

      if (result.added > 0) setCartDrawerOpen(true);
      return result;
    } finally {
      setReordering(false);
    }
  }, [addItem, setCartDrawerOpen]);

  return { reorder, reordering };
}
