import type { Product, ProductListParams, CreateProductDTO, UpdateProductDTO } from "@/types/product";
import type { PaginatedResponse } from "@/types/api";
import type { IProductService } from "../interfaces/product.interface";

const BASE = "/api/products";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export class ApiProductService implements IProductService {
  private buildUrl(params: Record<string, string | number | boolean | undefined>) {
    const url = new URL(BASE, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, String(v)); });
    return url.toString();
  }

  async getAll(params?: ProductListParams): Promise<PaginatedResponse<Product>> {
    return fetchJson(this.buildUrl({ page: params?.page, page_size: params?.page_size, category: params?.category, subcategory: params?.subcategory, sort_by: params?.sort_by, search: params?.search, min_price: params?.min_price, max_price: params?.max_price, badges: params?.badges?.join(","), all: params?.all ? "1" : undefined }));
  }

  async getById(id: string): Promise<Product | null> {
    try { return await fetchJson(`${BASE}/${id}`); } catch { return null; }
  }

  async getBySlug(slug: string): Promise<Product | null> {
    try { return await fetchJson(`${BASE}/${slug}`); } catch { return null; }
  }

  async getByCategory(categorySlug: string, params?: ProductListParams): Promise<PaginatedResponse<Product>> {
    return this.getAll({ ...params, category: categorySlug });
  }

  async getRelated(productId: string, limit = 8): Promise<Product[]> {
    const product = await this.getById(productId);
    if (!product) return [];
    const res = await this.getAll({ category: product.category_id, page_size: limit + 1 });
    return res.data.filter((p) => p.id !== productId).slice(0, limit);
  }

  async getFeatured(limit = 8): Promise<Product[]> {
    const res = await fetchJson<PaginatedResponse<Product>>(this.buildUrl({ featured: "true", limit }));
    return res.data;
  }

  async getNewArrivals(limit = 8): Promise<Product[]> {
    const res = await fetchJson<PaginatedResponse<Product>>(this.buildUrl({ badges: "new", sort_by: "newest", limit }));
    return res.data;
  }

  async getBestsellers(limit = 8): Promise<Product[]> {
    const res = await fetchJson<PaginatedResponse<Product>>(this.buildUrl({ badges: "bestseller", limit }));
    return res.data;
  }

  async getTrending(limit = 8): Promise<Product[]> {
    const res = await fetchJson<PaginatedResponse<Product>>(this.buildUrl({ badges: "trending", limit }));
    return res.data;
  }

  async getPreorders(limit = 8): Promise<Product[]> {
    const res = await fetchJson<PaginatedResponse<Product>>(this.buildUrl({ category: "preorder", limit }));
    return res.data;
  }

  async search(q: string, params?: ProductListParams): Promise<PaginatedResponse<Product>> {
    return this.getAll({ ...params, search: q });
  }

  async create(data: CreateProductDTO): Promise<Product> {
    const res = await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.json();
  }

  async update(id: string, data: UpdateProductDTO): Promise<Product> {
    const res = await fetch(`${BASE}/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.json();
  }

  async delete(id: string): Promise<void> {
    await fetch(`${BASE}/${id}`, { method: "DELETE" });
  }
}
