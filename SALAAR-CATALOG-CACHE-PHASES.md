# Salaar Catalog Cache Rollout

## Goal
Reduce repeated product database reads while keeping product cards, prices, stock, images, and category results current. Supabase remains the intended primary data source and Firebase remains the fallback.

## Phase 1 — Shared catalog memory
- Load the dual-read catalog into a server-side Next.js/Vercel Data Cache.
- Cache a compact product representation only; images remain URLs served from the existing image origin.
- Safety refresh every 15 minutes.
- Preserve Supabase-primary / Firebase-fallback behavior.

Acceptance:
- Cached snapshot returns the same product/category totals as the active catalog source.
- Repeated Salaar product messages reuse the shared catalog snapshot instead of full-reading the database per message.

## Phase 2 — 30 product/image cards per category
- Return up to 30 matching product cards per request.
- Keep up to 400 shown product IDs in the customer session so larger categories can continue without immediately repeating earlier products.
- Treat “aur / more / next / mazeed / baqi dikhao” as continuation of the previous product query.
- Send only a compact sample of up to 10 matched products to the LLM context so 30 UI cards do not multiply model token usage.

Acceptance:
- Glass bangles currently has 86 products and returns at most 30 in the first batch.
- Subsequent continuation requests can progress through the remaining products without repeating the first batch.

## Phase 3 — Instant admin refresh
- Invalidate storefront and Salaar catalog cache tags after product/category create, update, set, or delete through the existing admin API.
- Existing Firebase-primary write and Supabase mirror flow remains unchanged.
- 15-minute cache refresh remains as recovery if a direct database change bypasses the admin API or invalidation is missed.

Acceptance:
- Admin product price/stock/image/category changes invalidate the Salaar catalog cache.
- No UI/design changes are required.

## Phase 4 — Safe Ready/order handoff
- Ready/order confirmation bypasses the Salaar cache and performs a live dual-read catalog check.
- Recalculate current price and reject Ready handoff when the product is missing, inactive, explicitly out of stock, or has no current price.
- Persist catalog source and verification timestamp with the Ready handoff.

Acceptance:
- Cached data can never be the sole authority for locking a Ready order.
- Backend verification failure leaves the order unconfirmed and routes the customer to human support instead of silently locking stale data.

## Phase 5 — Vercel preview verification
Verify on the feature branch before any main merge:
- Next.js build, lint/type checks, and route generation succeed.
- Catalog-health endpoint reports total products/categories, selected category count, batch size 30, and active source.
- Glass bangles first batch is 30.
- Vercel runtime source is inspected so a Firebase fallback is not mistaken for a successful Supabase-primary read.

## Required production environment gate
For the intended Supabase-primary setup to be truly active on Vercel, the Vercel project must have the required Supabase runtime variables configured. GitHub Actions environment secrets do not automatically become Vercel runtime environment variables.

Required for the current server dual-read/dual-write design:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` for RLS-protected public catalog/category/skill reads
- `SUPABASE_SERVICE_ROLE_KEY` for server-only private reads and Firebase-primary -> Supabase write mirroring

`SUPABASE_SERVICE_ROLE_KEY` must remain server-only, must never use a `NEXT_PUBLIC_` name, and must never be committed. The publishable key is not a replacement for the service-role requirement on the current private/mirroring paths.

Do not merge this feature to main while Vercel reports Supabase-primary mode but serves the catalog from Firebase because Supabase runtime credentials are missing.
