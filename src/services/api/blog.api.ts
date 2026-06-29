import type { BlogPost } from "@/types/blog";
import type { PaginatedResponse } from "@/types/api";
import type { IBlogService } from "../interfaces/blog.interface";

export class ApiBlogService implements IBlogService {
  async getAll(params?: { page?: number; page_size?: number; category?: string }): Promise<PaginatedResponse<BlogPost>> {
    const res = await fetch("/api/blog?limit=50");
    const posts: BlogPost[] = await res.json();
    let filtered = posts;
    if (params?.category) filtered = filtered.filter((p) => p.category.toLowerCase() === params.category!.toLowerCase());
    const page = params?.page || 1;
    const pageSize = params?.page_size || 12;
    return { data: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, page_size: pageSize, total_pages: Math.ceil(filtered.length / pageSize) };
  }

  async getBySlug(slug: string): Promise<BlogPost | null> {
    try {
      const res = await fetch(`/api/blog?slug=${slug}`);
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  async getById(id: string): Promise<BlogPost | null> {
    const all = await this.getAll();
    return all.data.find((p) => p.id === id) || null;
  }

  async getRecent(limit = 3): Promise<BlogPost[]> {
    const res = await fetch(`/api/blog?limit=${limit}`);
    return res.json();
  }

  async create(data: Partial<BlogPost>): Promise<BlogPost> {
    const res = await fetch("/api/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.json();
  }

  async update(id: string, data: Partial<BlogPost>): Promise<BlogPost> {
    const res = await fetch(`/api/blog/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.json();
  }

  async delete(id: string): Promise<void> {
    await fetch(`/api/blog/${id}`, { method: "DELETE" });
  }
}
