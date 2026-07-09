---
name: fetch-as-markdown
description: Fetch ChineXa product, blog, category, brand, and policy pages as clean Markdown instead of HTML by sending an Accept text/markdown header.
---

# Fetch Pages as Markdown

ChineXa's storefront pages are normally rendered as interactive HTML for browsers. A subset of content pages also support content negotiation: request the same URL with `Accept: text/markdown` and get back a clean, structured Markdown document instead.

## When to use this

Use this instead of scraping/rendering HTML whenever you need the text content of one of the eligible pages below — it's faster to parse, has no script/style noise, and is the intended machine-readable representation of that page.

## How it works

Send a normal `GET` request to the page URL with the `Accept` header set to `text/markdown`:

```
curl https://chinexabd.com/products/some-product-slug -H "Accept: text/markdown"
```

The response has `Content-Type: text/markdown; charset=utf-8` and an `x-markdown-tokens` header (an approximate token count for context-budgeting). Requests without that `Accept` header get the normal HTML page, unaffected.

## Eligible URL patterns

| Pattern | Content |
|---|---|
| `/` (homepage) | Store title/description, category links, and links to the real content — a summary/index, not a full render of the homepage's live sections |
| `/products/{slug}` | Product name, price, description, variants table, ingredients, how-to-use |
| `/blog/{slug}` | Blog post title, author, date, full body (converted from HTML) |
| `/policies/{slug}` | Policy title, intro, sections (e.g. `shipping`, `returns`, `privacy`, `terms`) |
| `/categories/{slug}` | Category name, description, a table of products in that category |
| `/brands/{slug}` | Brand name, country, description, a table of that brand's products |

Other pages (cart, checkout, account/dashboard pages, search) do not support this — they're interactive UI with no stable document form to convert. Use the [`browse-products`](/.well-known/agent-skills/browse-products/SKILL.md) skill's JSON API for those instead.

## Notes

- A `404` slug returns a small Markdown "Not Found" document (still `text/markdown`), not an HTML error page.
- If the underlying data can't be loaded (e.g. a transient outage), you'll get a `text/markdown` "Temporarily Unavailable" document with HTTP 500 — safe to retry.
