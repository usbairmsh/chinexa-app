export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image: string;
  variant_id?: string;
  variant_name?: string;
  price: number;
  compare_at_price?: number;
  quantity: number;
  stock: number;
  /** True when this line is a pre-order (out-of-stock, `preorder`-badged product
   *  reserved for COD-on-arrival). Pre-order lines can't share a cart with
   *  in-stock lines — they check out separately. */
  isPreorder?: boolean;
  /** Optional expected-availability date (YYYY-MM-DD) shown for pre-order lines. */
  preorderExpectedDate?: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  tax: number;
  total: number;
  coupon_code?: string;
  item_count: number;
}
