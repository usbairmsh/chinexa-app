export interface Offer {
  id: string;
  title: string;
  description?: string;
  type: string;
  category?: string;
  discount: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}
