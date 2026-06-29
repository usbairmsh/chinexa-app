export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent_id?: string;
  order: number;
  is_active: boolean;
  product_count: number;
  children?: Category[];
  seo_title?: string;
  seo_description?: string;
  created_at: string;
}

export interface CategoryTree extends Category {
  children: CategoryTree[];
}
