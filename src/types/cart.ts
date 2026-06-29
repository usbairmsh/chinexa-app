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
