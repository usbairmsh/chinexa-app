import type { Coupon } from "@/types/coupon";
import type { PaginatedResponse } from "@/types/api";

export interface ICouponService {
  getAll(params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<Coupon>>;
  getById(id: string): Promise<Coupon | null>;
  validate(code: string, orderTotal: number): Promise<{ valid: boolean; discount: number; message: string }>;
  create(data: Partial<Coupon>): Promise<Coupon>;
  update(id: string, data: Partial<Coupon>): Promise<Coupon>;
  delete(id: string): Promise<void>;
}
