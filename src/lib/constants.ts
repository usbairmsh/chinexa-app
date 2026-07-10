export const SITE_NAME = "ChineXa";
export const SITE_DESCRIPTION = "Premium Beauty & Lifestyle";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
export const CURRENCY = { code: "BDT", symbol: "৳", locale: "en-BD" };
export const PHONE_PREFIX = "+880";
export const DEFAULT_OTP = "123456";

export const ITEMS_PER_PAGE = 12;
export const MAX_COMPARE_ITEMS = 4;
export const MAX_CART_QUANTITY = 10;

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "on_delivery",
  "received",
  "not_received",
] as const;

export const PAYMENT_METHODS = [
  { id: "COD", name: "Cash on Delivery", icon: "Banknote" },
  { id: "bkash", name: "bKash", icon: "Smartphone" },
  { id: "nagad", name: "Nagad", icon: "Smartphone" },
  { id: "rocket", name: "Rocket", icon: "Smartphone" },
  { id: "card", name: "Credit/Debit Card", icon: "CreditCard" },
] as const;

export const DIVISIONS = [
  "Dhaka",
  "Chittagong",
  "Rajshahi",
  "Khulna",
  "Barisal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
] as const;

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1440,
} as const;
