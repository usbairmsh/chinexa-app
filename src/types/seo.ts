export interface SeoMetadata {
  page_path: string;
  title: string;
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_type?: string;
  twitter_card?: "summary" | "summary_large_image";
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
  no_index?: boolean;
  no_follow?: boolean;
  schema_type?: string;
  custom_schema?: string;
}

export interface SeoGlobalSettings {
  site_title: string;
  site_description: string;
  default_og_image: string;
  google_analytics_id?: string;
  google_search_console?: string;
  meta_pixel_id?: string;
  tiktok_pixel_id?: string;
  bing_webmaster?: string;
  pinterest_verification?: string;
  robots_txt: string;
}

export interface SeoRedirect {
  id: string;
  from_path: string;
  to_path: string;
  type: 301 | 302;
  is_active: boolean;
  created_at: string;
}
