export interface BannerCrop {
  x: number;   // 0-100, object-position X %
  y: number;   // 0-100, object-position Y %
  zoom: number; // 1 = no zoom, 1.5 = 150%, etc.
}

export type TextAnimation = "slide-left" | "slide-right" | "slide-up" | "slide-down" | "fade" | "zoom" | "none";
export type CarouselTransition = "fade" | "slide" | "zoom" | "none";
export type TextPositionH = "left" | "center" | "right";
export type TextPositionV = "top" | "center" | "bottom";
export type DescriptionOrder = "above" | "below";

export interface BannerSettings {
  showTitle: boolean;
  showDescription: boolean;
  overlayEnabled: boolean;
  overlayBlur: number;      // px, 0 = no blur
  overlayOpacity: number;   // 0-1
  positionH: TextPositionH;
  positionV: TextPositionV;
  descriptionOrder: DescriptionOrder;
  titleAnimation: TextAnimation;
  descriptionAnimation: TextAnimation;
  carouselTransition: CarouselTransition;
  transitionDuration: number; // ms, carousel autoplay interval
}

export const DEFAULT_BANNER_SETTINGS: BannerSettings = {
  showTitle: true,
  showDescription: true,
  overlayEnabled: true,
  overlayBlur: 0,
  overlayOpacity: 0.5,
  positionH: "left",
  positionV: "center",
  descriptionOrder: "above",
  titleAnimation: "slide-up",
  descriptionAnimation: "fade",
  carouselTransition: "fade",
  transitionDuration: 6000,
};

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
  settings?: string | BannerSettings; // JSON string (API) or parsed object (client)
  order: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
}
