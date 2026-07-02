import {
  Shield, ShieldCheck, ShieldAlert, Truck, RotateCcw, Zap, Award, Globe, Heart,
  CheckCircle2, Clock, Gift, Headphones, Tag, Lock, Banknote, BadgeCheck,
  PackageCheck, ThumbsUp, Star, Sparkles, Verified, Medal, Crown,
  Gem, Leaf, Recycle, Fingerprint, Eye, Flame, Target, CircleDollarSign,
  HandHeart, RefreshCcw, Timer, Box, ShoppingBag, CreditCard, Wallet,
  type LucideIcon,
} from "lucide-react";

export interface TrustBadgeOption {
  id: string;
  name: string;
  icon: LucideIcon;
}

// Curated icon pack for trust/quality/delivery badges
export const TRUST_ICON_PACK: TrustBadgeOption[] = [
  { id: "Shield", name: "Shield", icon: Shield },
  { id: "ShieldCheck", name: "Shield Check", icon: ShieldCheck },
  { id: "ShieldAlert", name: "Shield Alert", icon: ShieldAlert },
  { id: "BadgeCheck", name: "Badge Check", icon: BadgeCheck },
  { id: "Verified", name: "Verified", icon: Verified },
  { id: "CheckCircle2", name: "Check Circle", icon: CheckCircle2 },
  { id: "ThumbsUp", name: "Thumbs Up", icon: ThumbsUp },
  { id: "Star", name: "Star", icon: Star },
  { id: "Award", name: "Award", icon: Award },
  { id: "Medal", name: "Medal", icon: Medal },
  { id: "Crown", name: "Crown", icon: Crown },
  { id: "Gem", name: "Gem", icon: Gem },
  { id: "Sparkles", name: "Sparkles", icon: Sparkles },
  { id: "Truck", name: "Truck", icon: Truck },
  { id: "PackageCheck", name: "Package Check", icon: PackageCheck },
  { id: "Box", name: "Box", icon: Box },
  { id: "ShoppingBag", name: "Shopping Bag", icon: ShoppingBag },
  { id: "Timer", name: "Timer", icon: Timer },
  { id: "Clock", name: "Clock", icon: Clock },
  { id: "Zap", name: "Zap / Fast", icon: Zap },
  { id: "Flame", name: "Flame / Hot", icon: Flame },
  { id: "RotateCcw", name: "Return", icon: RotateCcw },
  { id: "RefreshCcw", name: "Refresh", icon: RefreshCcw },
  { id: "Lock", name: "Lock / Secure", icon: Lock },
  { id: "Fingerprint", name: "Fingerprint", icon: Fingerprint },
  { id: "Eye", name: "Eye / Verified", icon: Eye },
  { id: "Globe", name: "Globe / Import", icon: Globe },
  { id: "Leaf", name: "Leaf / Natural", icon: Leaf },
  { id: "Recycle", name: "Recycle / Eco", icon: Recycle },
  { id: "Heart", name: "Heart", icon: Heart },
  { id: "HandHeart", name: "Care / Support", icon: HandHeart },
  { id: "Headphones", name: "Headphones / Support", icon: Headphones },
  { id: "Gift", name: "Gift", icon: Gift },
  { id: "Tag", name: "Tag / Price", icon: Tag },
  { id: "Target", name: "Target", icon: Target },
  { id: "Banknote", name: "Banknote / COD", icon: Banknote },
  { id: "CreditCard", name: "Credit Card", icon: CreditCard },
  { id: "Wallet", name: "Wallet", icon: Wallet },
  { id: "CircleDollarSign", name: "Dollar / Price", icon: CircleDollarSign },
];

export function getIconById(iconId: string): LucideIcon {
  return TRUST_ICON_PACK.find((i) => i.id === iconId)?.icon || Shield;
}

// Stored trust badge (from DB)
export interface TrustBadge {
  id: string;
  icon: string; // icon ID from TRUST_ICON_PACK
  title: string; // max 25 chars
  description: string; // max 40 chars
}
