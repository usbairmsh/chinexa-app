import { MockAuthService } from "./mock/auth.mock";

import { ApiProductService } from "./api/product.api";
import { ApiCategoryService } from "./api/category.api";
import { ApiBannerService } from "./api/banner.api";
import { ApiBlogService } from "./api/blog.api";

import type { IProductService } from "./interfaces/product.interface";
import type { ICategoryService } from "./interfaces/category.interface";
import type { IAuthService } from "./interfaces/auth.interface";
import type { IBannerService } from "./interfaces/banner.interface";
import type { IBlogService } from "./interfaces/blog.interface";

export interface Services {
  products: IProductService;
  categories: ICategoryService;
  auth: IAuthService;
  banners: IBannerService;
  blog: IBlogService;
}

// Every service is now DB-backed except auth (stays mock until a real auth
// backend exists). The mock/seed variants of the other services were dead
// code — nothing sets NEXT_PUBLIC_API_MODE=mock in any real environment —
// so they were removed instead of kept as an unused branch.
function createServices(): Services {
  return {
    products: new ApiProductService(),
    categories: new ApiCategoryService(),
    auth: new MockAuthService(), // Auth stays mock until Django backend
    banners: new ApiBannerService(),
    blog: new ApiBlogService(),
  };
}

export const services = createServices();
