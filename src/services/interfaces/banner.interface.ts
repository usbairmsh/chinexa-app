import type { Banner } from "@/types/banner";

export interface IBannerService {
  getAll(): Promise<Banner[]>;
  getByPosition(position: Banner["position"]): Promise<Banner[]>;
  getById(id: string): Promise<Banner | null>;
  create(data: Partial<Banner>): Promise<Banner>;
  update(id: string, data: Partial<Banner>): Promise<Banner>;
  delete(id: string): Promise<void>;
}
