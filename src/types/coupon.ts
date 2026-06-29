export type DiscountType = "percentage" | "fixed";

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  used_count: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  applicable_categories?: string[];
  applicable_products?: string[];
  created_at: string;
}
