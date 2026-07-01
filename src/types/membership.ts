export interface MembershipTier {
  id: string;
  name: string;
  min_points: number;
  max_points: number;
  points_multiplier: number;
  color: string;
  benefits: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PointsEntry {
  id: string;
  customer_id: string;
  points: number;
  type: "purchase" | "bonus" | "redemption" | "admin_adjustment" | "coupon_reward" | "refund";
  reference_id?: string;
  description: string;
  created_at: string;
}

export interface CustomerCoupon {
  id: string;
  coupon_id: string;
  customer_id?: string;
  tier_name?: string;
  is_used: boolean;
  assigned_at: string;
  used_at?: string;
  // Joined fields
  coupon_code?: string;
  coupon_description?: string;
  discount_type?: string;
  discount_value?: number;
  valid_until?: string;
}

export interface CustomerMembership {
  total_points: number;
  tier: MembershipTier | null;
  next_tier: MembershipTier | null;
  points_to_next_tier: number;
}
