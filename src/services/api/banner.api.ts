import type { Banner } from "@/types/banner";
import type { IBannerService } from "../interfaces/banner.interface";

export class ApiBannerService implements IBannerService {
  async getAll(): Promise<Banner[]> {
    const res = await fetch("/api/banners");
    return res.json();
  }

  async getByPosition(position: Banner["position"]): Promise<Banner[]> {
    const res = await fetch(`/api/banners?position=${position}`);
    return res.json();
  }

  async getById(id: string): Promise<Banner | null> {
    const all = await this.getAll();
    return all.find((b) => b.id === id) || null;
  }

  async create(data: Partial<Banner>): Promise<Banner> {
    const res = await fetch("/api/banners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.json();
  }

  async update(id: string, data: Partial<Banner>): Promise<Banner> {
    const res = await fetch(`/api/banners/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.json();
  }

  async delete(id: string): Promise<void> {
    await fetch(`/api/banners/${id}`, { method: "DELETE" });
  }
}
