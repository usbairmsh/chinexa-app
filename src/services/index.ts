import { MockProductService } from "./mock/product.mock";
import { MockCategoryService } from "./mock/category.mock";
import { MockAuthService } from "./mock/auth.mock";
import { MockBannerService } from "./mock/banner.mock";
import { MockBlogService } from "./mock/blog.mock";
import { MockAnalyticsService } from "./mock/analytics.mock";

import { ApiProductService } from "./api/product.api";
import { ApiCategoryService } from "./api/category.api";
import { ApiBannerService } from "./api/banner.api";
import { ApiBlogService } from "./api/blog.api";

import type { IProductService } from "./interfaces/product.interface";
import type { ICategoryService } from "./interfaces/category.interface";
import type { IAuthService } from "./interfaces/auth.interface";
import type { IBannerService } from "./interfaces/banner.interface";
import type { IBlogService } from "./interfaces/blog.interface";
import type { IAnalyticsService } from "./interfaces/analytics.interface";

export interface Services {
  products: IProductService;
  categories: ICategoryService;
  auth: IAuthService;
  banners: IBannerService;
  blog: IBlogService;
  analytics: IAnalyticsService;
}

// Default to "api" (real DB) so a missing/empty env var can never silently
// drop production into mock mode. Set NEXT_PUBLIC_API_MODE=mock explicitly for
// local mock development.
const API_MODE = process.env.NEXT_PUBLIC_API_MODE || "api";

function createServices(): Services {
  if (API_MODE === "api") {
    // Database-backed services via API routes → MySQL
    return {
      products: new ApiProductService(),
      categories: new ApiCategoryService(),
      auth: new MockAuthService(), // Auth stays mock until Django backend
      banners: new ApiBannerService(),
      blog: new ApiBlogService(),
      analytics: new MockAnalyticsService(), // Analytics stays mock for now
    };
  }

  // Mock services (default)
  return {
    products: new MockProductService(),
    categories: new MockCategoryService(),
    auth: new MockAuthService(),
    banners: new MockBannerService(),
    blog: new MockBlogService(),
    analytics: new MockAnalyticsService(),
  };
}

export const services = createServices();
