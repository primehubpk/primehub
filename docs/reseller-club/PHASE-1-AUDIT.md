# PrimeHub Reseller Club — Phase 1 Audit

## Scope
Phase 1 is audit/planning only. No existing storefront, Firebase, cart, orders, Reward Hub, Weekly Deals, or admin behavior is changed in this phase.

## Protected baseline
- Base branch: `main`
- Working branch: `feature/reseller-club-phase-1`
- Phase 1 must not modify `main`.

## Current storefront findings
- `app/page.tsx` renders the homepage and passes price-bucket selection state into `components/PriceBuckets.tsx`.
- `components/PriceBuckets.tsx` already reads active `settings.priceBuckets` from the shared settings hook and supports admin-managed icon URLs, accent colors, ordering, and active state.
- Existing Wholesale Deals is recognized by `isWholesalePriceBucket(bucket)` and uses the same Price Bucket data model.
- `lib/types.ts` currently defines `PriceBucket` with: `id`, `title`, optional `amount`, `iconUrl`, `accent`, `sortOrder`, and `active`.
- `lib/useSettings.ts` reads `settings/main` plus legacy/general, policy, and contact settings. Price buckets are currently part of the shared `SiteSettings` structure.

## Phase 1 decision
The new PrimeHub Reseller Club card should reuse the existing admin-controlled Price Bucket system rather than introduce a second hard-coded card system.

## Planned next phase
Phase 2 will introduce the visual Reseller Club entry/landing experience on the working branch only. It will remain mobile-first and isolated behind small, focused files where practical.

## Safety rules
1. Do not edit `main` directly.
2. Do not create a second `weeklyDeals` source.
3. Do not replace existing Reward Hub/account behavior.
4. Do not change existing cart/order calculation logic during UI work.
5. Any Firebase/auth/wallet/reward data model changes must be introduced in their own phase and reviewed before use.
6. Reseller rewards should be configurable and should not become withdrawable until the order reaches the agreed eligible state (for example, delivered/return-window completed).
