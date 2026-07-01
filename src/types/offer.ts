export type OfferApplicability = "store" | "categories" | "subcategories" | "customers";

export interface Offer {
  id: string;
  title: string;
  description?: string;
  applicability: OfferApplicability;
  applicable_ids: string[];
  applicable_names?: string[];
  discount: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}
