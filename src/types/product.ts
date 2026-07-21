export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  order: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  type: "size" | "color" | "shade" | "weight";
  value: string;
  hex?: string;
  price_adjustment: number;
  cost_price_adjustment?: number;
  stock: number;
  sku: string;
  image?: string;
  focal_point?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  sku: string;
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  currency: string;
  images: ProductImage[];
  category_id: string;
  category_name: string;
  subcategory?: string;
  brand_id?: string;
  brand_name?: string;
  tags: string[];
  badges: ProductBadge[];
  variants: ProductVariant[];
  stock_quantity: number;
  min_stock: number;
  max_stock: number;
  /** Optional "expected availability" date (YYYY-MM-DD) shown for pre-order products. */
  preorder_release_date?: string;
  /** Timestamp of the most recent restock; drives the "Exclusive" listing + stock list. */
  last_restocked_at?: string;
  /** How many customers wishlisted this product while it was out of stock (demand signal). */
  oos_wishlist_count?: number;
  is_active: boolean;
  is_featured: boolean;
  average_rating: number;
  review_count: number;
  country_of_origin?: string;
  weight?: string;
  ingredients?: string;
  how_to_use?: string;
  trust_badges?: string[];
  created_at: string;
  updated_at: string;
  seo_title?: string;
  seo_description?: string;
}

export type ProductBadge = "new" | "sale" | "bestseller" | "preorder" | "limited" | "trending";

export interface ProductListParams {
  page?: number;
  page_size?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  sort_by?: "featured" | "newest" | "price_asc" | "price_desc" | "rating" | "name_asc" | "name_desc" | "restocked" | "wishlist_desc" | "date_added";
  search?: string;
  tags?: string[];
  badges?: ProductBadge[];
  in_stock?: boolean;
  /** Recently added OR restocked (last 30 days) — the "Exclusive" listing. */
  exclusive?: boolean;
  all?: boolean;
}

export interface CreateProductDTO {
  name: string;
  description: string;
  short_description: string;
  sku: string;
  price: number;
  compare_at_price?: number;
  cost_price?: number;
  images: { url: string; alt: string }[];
  category_id: string;
  subcategory?: string;
  tags: string[];
  badges: ProductBadge[];
  variants: Omit<ProductVariant, "id">[];
  stock_quantity: number;
  min_stock?: number;
  max_stock?: number;
  preorder_release_date?: string | null;
  is_active: boolean;
  is_featured: boolean;
  country_of_origin?: string;
  weight?: string;
  ingredients?: string;
  how_to_use?: string;
  seo_title?: string;
  seo_description?: string;
}

export type UpdateProductDTO = Partial<CreateProductDTO>;
