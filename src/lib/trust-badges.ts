export interface TrustBadge {
  id: string;
  label: string;
  sub: string;
  icon: string; // lucide icon name
}

export const TRUST_BADGE_OPTIONS: TrustBadge[] = [
  { id: "authentic", label: "100% Authentic", sub: "Verified products", icon: "Shield" },
  { id: "free_delivery", label: "Free Delivery", sub: "On eligible orders", icon: "Truck" },
  { id: "returns", label: "7-Day Returns", sub: "Hassle free", icon: "RotateCcw" },
  { id: "genuine", label: "100% Genuine", sub: "Original products", icon: "BadgeCheck" },
  { id: "cash_on_delivery", label: "Cash on Delivery", sub: "Pay when you receive", icon: "Banknote" },
  { id: "secure_payment", label: "Secure Payment", sub: "SSL encrypted", icon: "Lock" },
  { id: "fast_shipping", label: "Fast Shipping", sub: "1-3 business days", icon: "Zap" },
  { id: "warranty", label: "Warranty", sub: "Quality guaranteed", icon: "Award" },
  { id: "imported", label: "Imported Original", sub: "Directly sourced", icon: "Globe" },
  { id: "cruelty_free", label: "Cruelty Free", sub: "Not tested on animals", icon: "Heart" },
  { id: "halal", label: "Halal Certified", sub: "Certified products", icon: "CheckCircle2" },
  { id: "express", label: "Express Delivery", sub: "Same day available", icon: "Clock" },
  { id: "gift_wrap", label: "Gift Wrapping", sub: "Available on request", icon: "Gift" },
  { id: "support", label: "24/7 Support", sub: "Always here to help", icon: "Headphones" },
  { id: "best_price", label: "Best Price", sub: "Price match guarantee", icon: "Tag" },
];
