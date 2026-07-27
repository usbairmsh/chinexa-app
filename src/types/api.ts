export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  /** Products list only: active/inactive totals across the full filtered set
   *  (independent of pagination), for admin tab counts. */
  active_count?: number;
  inactive_count?: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status: number;
}
