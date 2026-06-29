import type { Review, ReviewSummary } from "@/types/review";
import type { PaginatedResponse } from "@/types/api";

export interface IReviewService {
  getByProduct(productId: string, params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<Review>>;
  getSummary(productId: string): Promise<ReviewSummary>;
  getAll(params?: { page?: number; page_size?: number; is_approved?: boolean }): Promise<PaginatedResponse<Review>>;
  create(data: { product_id: string; rating: number; title?: string; comment: string }): Promise<Review>;
  approve(id: string): Promise<Review>;
  reject(id: string): Promise<void>;
  reply(id: string, reply: string): Promise<Review>;
  getRecent(limit?: number): Promise<Review[]>;
}
