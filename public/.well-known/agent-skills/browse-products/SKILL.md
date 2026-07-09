---
name: browse-products
description: Search, filter, and read ChineXa's product catalog (skincare, bags, jewelry, perfumes and more) via the public REST API — no authentication required.
---

# Browse Products

ChineXa is a beauty & lifestyle e-commerce store based in Bangladesh. This skill covers reading its live product catalog programmatically.

## When to use this

Use this when a user asks about ChineXa's products, prices, availability, or categories — e.g. "what skincare does ChineXa sell", "find bags under ৳3000 at ChineXa".

## Endpoints

All endpoints are plain, unauthenticated `GET` requests returning JSON. See [`/.well-known/api-catalog`](/.well-known/api-catalog) for the full, current list.

### Search / list products

```
GET /api/products?search={query}&category={slug}&brand={name}&min_price={n}&max_price={n}&sort_by={featured|newest|price_asc|price_desc|rating}&page={n}&page_size={n}
```

All query parameters are optional. Response shape:

```json
{
  "data": [
    { "id": "...", "name": "...", "slug": "...", "price": 2500, "compare_at_price": 3200,
      "category_name": "Skincare", "brand_name": "...", "average_rating": 4.5,
      "stock_quantity": 12, "images": [{ "url": "..." }], "variants": [...] }
  ],
  "total": 42, "page": 1, "page_size": 12, "total_pages": 4
}
```

### Single product

```
GET /api/products/{slug}
```

Returns the same shape as one entry above, plus `description`, `ingredients`, `how_to_use`.

### Categories and brands

```
GET /api/categories
GET /api/brands
GET /api/brands/{slug}
```

## Notes

- Prices are in Bangladeshi Taka (৳ / BDT).
- `cost_price` is never included in these responses — it's internal margin data, not part of the public API.
- These endpoints have no rate limiting today; cache results and avoid tight polling loops (see [`/auth.md`](/auth.md)).
- For a human-readable page instead of JSON, request the same product/category/brand URL on the storefront (e.g. `/products/{slug}`) with an `Accept: text/markdown` header — see the `fetch-as-markdown` skill.
