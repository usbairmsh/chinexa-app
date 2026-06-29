import type { BlogPost } from "@/types/blog";
import type { PaginatedResponse } from "@/types/api";

export interface IBlogService {
  getAll(params?: { page?: number; page_size?: number; category?: string }): Promise<PaginatedResponse<BlogPost>>;
  getBySlug(slug: string): Promise<BlogPost | null>;
  getById(id: string): Promise<BlogPost | null>;
  getRecent(limit?: number): Promise<BlogPost[]>;
  create(data: Partial<BlogPost>): Promise<BlogPost>;
  update(id: string, data: Partial<BlogPost>): Promise<BlogPost>;
  delete(id: string): Promise<void>;
}
