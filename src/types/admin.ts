export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  slug: string;
  group: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  user_count: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
  timestamp: string;
}

export interface FraudAlert {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  risk_score: number;
  risk_factors: string[];
  status: "flagged" | "reviewed" | "cleared" | "blocked";
  reviewed_by?: string;
  created_at: string;
}
