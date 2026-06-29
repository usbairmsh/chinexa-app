import type { Order, OrderStatus, CreateOrderDTO } from "@/types/order";
import type { PaginatedResponse } from "@/types/api";

export interface IOrderService {
  getAll(params?: { page?: number; page_size?: number; status?: OrderStatus }): Promise<PaginatedResponse<Order>>;
  getById(id: string): Promise<Order | null>;
  getByCustomer(customerId: string, params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<Order>>;
  create(data: CreateOrderDTO): Promise<Order>;
  updateStatus(id: string, status: OrderStatus, note?: string): Promise<Order>;
  getRecent(limit?: number): Promise<Order[]>;
}
