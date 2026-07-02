import type { OfferApplicability } from "@/types/offer";

export type DiscountType = "percentage" | "fixed";

export type CouponApplicability = OfferApplicability;

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  /** Global total redemptions across all customers */
  usage_limit?: number;
  /** How many times a single customer may redeem this coupon */
  per_customer_limit?: number;
  used_count: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  /** Who/what the coupon applies to (same model as offers); defaults to "store" */
  applicability?: CouponApplicability;
  applicable_ids?: string[];
  applicable_names?: string[];
  applicable_categories?: string[];
  applicable_products?: string[];
  created_at: string;
}
