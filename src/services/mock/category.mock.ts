import { categories } from "@/data/seed/categories";
import type { Category } from "@/types/category";
import type { ICategoryService } from "../interfaces/category.interface";
import { delay, randomId } from "@/lib/utils";

export class MockCategoryService implements ICategoryService {
  private data = [...categories];

  async getAll(): Promise<Category[]> {
    await delay(200);
    return this.data.filter((c) => c.is_active);
  }

  async getById(id: string): Promise<Category | null> {
    await delay(150);
    const find = (cats: Category[]): Category | null => {
      for (const cat of cats) {
        if (cat.id === id) return cat;
        if (cat.children) {
          const found = find(cat.children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(this.data);
  }

  async getBySlug(slug: string): Promise<Category | null> {
    await delay(150);
    const find = (cats: Category[]): Category | null => {
      for (const cat of cats) {
        if (cat.slug === slug) return cat;
        if (cat.children) {
          const found = find(cat.children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(this.data);
  }

  async create(data: Partial<Category>): Promise<Category> {
    await delay(300);
    const category: Category = {
      id: `cat-${randomId()}`,
      name: data.name || "",
      slug: data.slug || "",
      description: data.description,
      image: data.image,
      parent_id: data.parent_id,
      order: data.order || this.data.length + 1,
      is_active: data.is_active ?? true,
      product_count: 0,
      created_at: new Date().toISOString(),
    };
    this.data.push(category);
    return category;
  }

  async update(id: string, data: Partial<Category>): Promise<Category> {
    await delay(300);
    const index = this.data.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Category not found");
    this.data[index] = { ...this.data[index], ...data };
    return this.data[index];
  }

  async delete(id: string): Promise<void> {
    await delay(200);
    this.data = this.data.filter((c) => c.id !== id);
  }
}
