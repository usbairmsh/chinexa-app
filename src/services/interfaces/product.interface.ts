import type { Product, ProductListParams, CreateProductDTO, UpdateProductDTO } from "@/types/product";
import type { PaginatedResponse } from "@/types/api";

export interface IProductService {
  getAll(params?: ProductListParams): Promise<PaginatedResponse<Product>>;
  getById(id: string): Promise<Product | null>;
  getBySlug(slug: string): Promise<Product | null>;
  getByCategory(categorySlug: string, params?: ProductListParams): Promise<PaginatedResponse<Product>>;
  getRelated(productId: string, limit?: number): Promise<Product[]>;
  getFeatured(limit?: number): Promise<Product[]>;
  getNewArrivals(limit?: number): Promise<Product[]>;
  getBestsellers(limit?: number): Promise<Product[]>;
  getTrending(limit?: number): Promise<Product[]>;
  getPreorders(limit?: number): Promise<Product[]>;
  search(query: string, params?: ProductListParams): Promise<PaginatedResponse<Product>>;
  create(data: CreateProductDTO): Promise<Product>;
  update(id: string, data: UpdateProductDTO): Promise<Product>;
  delete(id: string): Promise<void>;
}
