import { blogPosts } from "@/data/seed/blog-posts";
import type { BlogPost } from "@/types/blog";
import type { PaginatedResponse } from "@/types/api";
import type { IBlogService } from "../interfaces/blog.interface";
import { delay, randomId, slugify } from "@/lib/utils";

export class MockBlogService implements IBlogService {
  private data = [...blogPosts];

  async getAll(params?: { page?: number; page_size?: number; category?: string }): Promise<PaginatedResponse<BlogPost>> {
    await delay(300);
    let filtered = this.data.filter((p) => p.is_published);
    if (params?.category) {
      filtered = filtered.filter((p) => p.category.toLowerCase() === params.category!.toLowerCase());
    }
    filtered.sort((a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime());
    const page = params?.page || 1;
    const pageSize = params?.page_size || 12;
    const total = filtered.length;
    return {
      data: filtered.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  async getBySlug(slug: string): Promise<BlogPost | null> {
    await delay(200);
    return this.data.find((p) => p.slug === slug) || null;
  }

  async getById(id: string): Promise<BlogPost | null> {
    await delay(200);
    return this.data.find((p) => p.id === id) || null;
  }

  async getRecent(limit = 3): Promise<BlogPost[]> {
    await delay(200);
    return this.data
      .filter((p) => p.is_published)
      .sort((a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime())
      .slice(0, limit);
  }

  async create(data: Partial<BlogPost>): Promise<BlogPost> {
    await delay(500);
    const post: BlogPost = {
      id: `blog-${randomId()}`,
      title: data.title || "",
      slug: data.slug || slugify(data.title || ""),
      excerpt: data.excerpt || "",
      content: data.content || "",
      featured_image: data.featured_image || "",
      category: data.category || "Uncategorized",
      tags: data.tags || [],
      author_name: data.author_name || "ChineXa Team",
      is_published: data.is_published ?? false,
      published_at: data.is_published ? new Date().toISOString() : undefined,
      reading_time: data.reading_time || 5,
      views: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.unshift(post);
    return post;
  }

  async update(id: string, data: Partial<BlogPost>): Promise<BlogPost> {
    await delay(400);
    const index = this.data.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("Blog post not found");
    this.data[index] = { ...this.data[index], ...data, updated_at: new Date().toISOString() };
    return this.data[index];
  }

  async delete(id: string): Promise<void> {
    await delay(300);
    this.data = this.data.filter((p) => p.id !== id);
  }
}
