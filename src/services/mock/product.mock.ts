import { products } from "@/data/seed/products";
import type { Product, ProductListParams, CreateProductDTO, UpdateProductDTO } from "@/types/product";
import type { PaginatedResponse } from "@/types/api";
import type { IProductService } from "../interfaces/product.interface";
import { delay, randomId, slugify } from "@/lib/utils";
import { ITEMS_PER_PAGE } from "@/lib/constants";

export class MockProductService implements IProductService {
  private data = [...products];

  private paginate(items: Product[], page = 1, pageSize = ITEMS_PER_PAGE): PaginatedResponse<Product> {
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    return {
      data: items.slice(start, start + pageSize),
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    };
  }

  private filter(params?: ProductListParams): Product[] {
    let filtered = this.data.filter((p) => p.is_active);

    if (params?.category) {
      filtered = filtered.filter((p) => p.category_id === params.category);
    }
    if (params?.subcategory) {
      filtered = filtered.filter((p) => p.subcategory === params.subcategory);
    }
    if (params?.min_price !== undefined) {
      filtered = filtered.filter((p) => p.price >= params.min_price!);
    }
    if (params?.max_price !== undefined) {
      filtered = filtered.filter((p) => p.price <= params.max_price!);
    }
    if (params?.tags?.length) {
      filtered = filtered.filter((p) => params.tags!.some((t) => p.tags.includes(t)));
    }
    if (params?.badges?.length) {
      filtered = filtered.filter((p) => params.badges!.some((b) => p.badges.includes(b)));
    }
    if (params?.in_stock) {
      filtered = filtered.filter((p) => p.stock_quantity > 0);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q))
      );
    }

    switch (params?.sort_by) {
      case "newest":
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "price_asc":
        filtered.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        filtered.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        filtered.sort((a, b) => b.average_rating - a.average_rating);
        break;
      case "name_asc":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "featured":
      default:
        filtered.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
        break;
    }

    return filtered;
  }

  async getAll(params?: ProductListParams): Promise<PaginatedResponse<Product>> {
    await delay(300);
    const filtered = this.filter(params);
    return this.paginate(filtered, params?.page, params?.page_size);
  }

  async getById(id: string): Promise<Product | null> {
    await delay(200);
    return this.data.find((p) => p.id === id) || null;
  }

  async getBySlug(slug: string): Promise<Product | null> {
    await delay(200);
    return this.data.find((p) => p.slug === slug) || null;
  }

  async getByCategory(categorySlug: string, params?: ProductListParams): Promise<PaginatedResponse<Product>> {
    await delay(300);
    const filtered = this.filter({ ...params, category: categorySlug });
    return this.paginate(filtered, params?.page, params?.page_size);
  }

  async getRelated(productId: string, limit = 8): Promise<Product[]> {
    await delay(200);
    const product = this.data.find((p) => p.id === productId);
    if (!product) return [];
    return this.data
      .filter((p) => p.id !== productId && p.category_id === product.category_id && p.is_active)
      .slice(0, limit);
  }

  async getFeatured(limit = 8): Promise<Product[]> {
    await delay(200);
    return this.data.filter((p) => p.is_featured && p.is_active).slice(0, limit);
  }

  async getNewArrivals(limit = 8): Promise<Product[]> {
    await delay(200);
    return [...this.data]
      .filter((p) => p.is_active && p.badges.includes("new"))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  async getBestsellers(limit = 8): Promise<Product[]> {
    await delay(200);
    return this.data.filter((p) => p.is_active && p.badges.includes("bestseller")).slice(0, limit);
  }

  async getTrending(limit = 8): Promise<Product[]> {
    await delay(200);
    return this.data.filter((p) => p.is_active && p.badges.includes("trending")).slice(0, limit);
  }

  async getPreorders(limit = 8): Promise<Product[]> {
    await delay(200);
    return this.data.filter((p) => p.is_active && p.category_id === "preorder").slice(0, limit);
  }

  async search(query: string, params?: ProductListParams): Promise<PaginatedResponse<Product>> {
    await delay(300);
    const filtered = this.filter({ ...params, search: query });
    return this.paginate(filtered, params?.page, params?.page_size);
  }

  async create(data: CreateProductDTO): Promise<Product> {
    await delay(500);
    const product: Product = {
      ...data,
      id: `prod-${randomId()}`,
      slug: slugify(data.name),
      currency: "BDT",
      category_name: data.category_id,
      images: data.images.map((img, i) => ({ ...img, id: `img-${randomId()}`, order: i })),
      variants: data.variants.map((v) => ({ ...v, id: `v-${randomId()}` })),
      min_stock: data.min_stock || 10,
      max_stock: data.max_stock || 100,
      average_rating: 0,
      review_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.unshift(product);
    return product;
  }

  async update(id: string, data: UpdateProductDTO): Promise<Product> {
    await delay(500);
    const index = this.data.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("Product not found");
    const updated = { ...this.data[index], ...data, updated_at: new Date().toISOString() } as Product;
    this.data[index] = updated;
    return this.data[index];
  }

  async delete(id: string): Promise<void> {
    await delay(300);
    this.data = this.data.filter((p) => p.id !== id);
  }
}
