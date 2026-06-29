export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "on_delivery"
  | "received"
  | "not_received";

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  product_slug: string;
  variant?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderAddress {
  name: string;
  phone: string;
  email?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  district: string;
  division: string;
  postal_code?: string;
}

export interface OrderTimeline {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  billing_address: OrderAddress;
  shipping_address: OrderAddress;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  payment_method: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  transaction_id?: string;
  coupon_code?: string;
  notes?: string;
  timeline: OrderTimeline[];
  created_at: string;
  updated_at: string;
}

export interface CreateOrderDTO {
  items: { product_id: string; variant_id?: string; quantity: number }[];
  billing_address: OrderAddress;
  shipping_address: OrderAddress;
  payment_method: string;
  coupon_code?: string;
  notes?: string;
}
