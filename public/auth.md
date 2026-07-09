# auth.md

## Status: no authentication required

The public API surface listed in [`/.well-known/api-catalog`](/.well-known/api-catalog) has **no registration, no API key, and no OAuth flow**. Every endpoint in that catalog is a plain, unauthenticated `GET` request — call it directly.

```
curl https://chinexabd.com/api/products
```

There is no `/register`, `/authorize`, or `/token` endpoint on this domain. If you are looking for one because another discovery document referenced it, that reference is stale — this site does not operate an OAuth/OIDC authorization server.

## What's available

See [`/.well-known/api-catalog`](/.well-known/api-catalog) (RFC 9727) for the current list of public, read-only endpoints: product listing, categories, brands, published blog posts, trending search terms, and membership tier definitions.

## What's not available

Everything outside that catalog — order creation, customer accounts, checkout, admin/accounting endpoints — is private application infrastructure, not a public API. It is not intended for external or automated callers, has no stable contract, and may change without notice.

## Fair use

These endpoints are unauthenticated and unrated-limited today. Please be a reasonable caller: cache responses, avoid tight polling loops, and identify your client with a descriptive `User-Agent`.

## Questions

For anything not covered by the catalog — partnership inquiries, higher-volume access, or anything else — use the contact page: https://chinexabd.com/contact
