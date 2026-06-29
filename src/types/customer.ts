export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  district: string;
  division: string;
  postal_code?: string;
  is_default: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  avatar?: string;
  addresses: Address[];
  total_orders: number;
  total_spent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_order_at?: string;
}
