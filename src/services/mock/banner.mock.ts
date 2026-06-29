import { banners } from "@/data/seed/banners";
import type { Banner } from "@/types/banner";
import type { IBannerService } from "../interfaces/banner.interface";
import { delay, randomId } from "@/lib/utils";

export class MockBannerService implements IBannerService {
  private data = [...banners];

  async getAll(): Promise<Banner[]> {
    await delay(200);
    return this.data.sort((a, b) => a.order - b.order);
  }

  async getByPosition(position: Banner["position"]): Promise<Banner[]> {
    await delay(150);
    return this.data.filter((b) => b.position === position && b.is_active).sort((a, b) => a.order - b.order);
  }

  async getById(id: string): Promise<Banner | null> {
    await delay(150);
    return this.data.find((b) => b.id === id) || null;
  }

  async create(data: Partial<Banner>): Promise<Banner> {
    await delay(300);
    const banner: Banner = {
      id: `banner-${randomId()}`,
      title: data.title || "",
      subtitle: data.subtitle,
      image: data.image || "",
      mobile_image: data.mobile_image,
      link: data.link,
      cta_text: data.cta_text,
      position: data.position || "hero",
      order: data.order || this.data.length + 1,
      is_active: data.is_active ?? true,
      start_date: data.start_date,
      end_date: data.end_date,
      created_at: new Date().toISOString(),
    };
    this.data.push(banner);
    return banner;
  }

  async update(id: string, data: Partial<Banner>): Promise<Banner> {
    await delay(300);
    const index = this.data.findIndex((b) => b.id === id);
    if (index === -1) throw new Error("Banner not found");
    this.data[index] = { ...this.data[index], ...data };
    return this.data[index];
  }

  async delete(id: string): Promise<void> {
    await delay(200);
    this.data = this.data.filter((b) => b.id !== id);
  }
}
