import type { Customer } from "@/types/customer";
import type { PaginatedResponse } from "@/types/api";

export interface ICustomerService {
  getAll(params?: { page?: number; page_size?: number; search?: string }): Promise<PaginatedResponse<Customer>>;
  getById(id: string): Promise<Customer | null>;
  update(id: string, data: Partial<Customer>): Promise<Customer>;
  getRecent(limit?: number): Promise<Customer[]>;
}
