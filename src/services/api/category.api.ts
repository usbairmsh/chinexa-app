import type { Category } from "@/types/category";
import type { ICategoryService } from "../interfaces/category.interface";

export class ApiCategoryService implements ICategoryService {
  async getAll(): Promise<Category[]> {
    const res = await fetch("/api/categories");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async getById(id: string): Promise<Category | null> {
    const cats = await this.getAll();
    const find = (list: Category[]): Category | null => {
      for (const c of list) { if (c.id === id) return c; if (c.children) { const f = find(c.children); if (f) return f; } }
      return null;
    };
    return find(cats);
  }

  async getBySlug(slug: string): Promise<Category | null> {
    const cats = await this.getAll();
    // Resolve by slug OR id — some links (e.g. product breadcrumbs) pass the id.
    const find = (list: Category[]): Category | null => {
      for (const c of list) { if (c.slug === slug || c.id === slug) return c; if (c.children) { const f = find(c.children); if (f) return f; } }
      return null;
    };
    return find(cats);
  }

  async create(data: Partial<Category>): Promise<Category> {
    const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.json();
  }

  async update(id: string, data: Partial<Category>): Promise<Category> {
    const res = await fetch(`/api/categories/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.json();
  }

  async delete(id: string): Promise<void> {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
  }
}
