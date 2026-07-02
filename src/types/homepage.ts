export type SectionType =
  | "hero"
  | "categories"
  | "new_arrivals"
  | "bestsellers"
  | "trending"
  | "preorder"
  | "brand_story"
  | "trust_badges"
  | "instagram"
  | "reviews"
  | "newsletter"
  | "blog_preview"
  | "brands"
  | "faq"
  | "promo_banner";

export interface HomepageSection {
  id: string;
  type: SectionType;
  title?: string;
  subtitle?: string;
  is_visible: boolean;
  order: number;
  config: Record<string, unknown>;
}

export interface HomepageConfig {
  sections: HomepageSection[];
  announcement_bar?: {
    text: string;
    link?: string;
    is_visible: boolean;
  };
}
