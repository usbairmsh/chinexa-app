export interface BannerCrop {
  x: number;   // 0-100, object-position X %
  y: number;   // 0-100, object-position Y %
  zoom: number; // 1 = no zoom, 1.5 = 150%, etc.
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  mobile_image?: string;
  link?: string;
  cta_text?: string;
  position: "hero" | "promo" | "category" | "popup";
  focal_point?: string; // JSON string of BannerCrop
  order: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
}
