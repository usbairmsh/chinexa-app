export interface Review {
  id: string;
  product_id: string;
  product_name: string;
  customer_id: string;
  customer_name: string;
  customer_avatar?: string;
  rating: number;
  title?: string;
  comment: string;
  is_verified_purchase: boolean;
  is_approved: boolean;
  admin_reply?: string;
  created_at: string;
}

export interface ReviewSummary {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
