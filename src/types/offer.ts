export type OfferApplicability = "store" | "categories" | "subcategories" | "products" | "brands" | "customers" | "tiers";

export type DiscountType = "percentage" | "fixed";

export interface Offer {
  id: string;
  title: string;
  description?: string;
  applicability: OfferApplicability;
  applicable_ids: string[];
  applicable_names?: string[];
  /** Display label, e.g. "30% OFF" — kept for backward compatibility */
  discount: string;
  /** Structured discount used for actual price calculation */
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}
