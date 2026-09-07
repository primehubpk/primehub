# Supabase Migration — Phase 1 Dual-Database Audit

Status: COMPLETE (audit + architecture lock only; no production cutover)

Branch: `feature/supabase-migration`
Base main commit: `0972aea6a257abafe94a9fbc7626554f764f494d`

## Locked migration architecture
- Supabase will become the primary operational database after final cutover.
- Firebase remains a synchronized backup/fallback during migration and after cutover where safe.
- Catalog/config data can use controlled dual-write and emergency read fallback.
- Transaction-sensitive data must keep one authoritative source of truth to avoid double credits, duplicate orders, or stale wallet balances.
- Cloudflare R2 remains the image store; image binaries are not migrated.

## Guardrails
- Do not merge to `main` until Phase 7 is complete and final checks pass.
- Do not intentionally deploy this migration branch to Vercel during Phases 1–7.
- Branch-specific Vercel Git deployments are disabled in `vercel.json` for `feature/supabase-migration`.
- Do not delete Firebase during migration or immediately after cutover.
- Keep Vercel hosting, UI, routes, product URLs, cart behavior, Cloudflare image URLs and customer-facing design unchanged.
- Preserve existing Firestore document IDs where they are referenced by URLs, orders, reviews, settings, reseller records or Salaar state.
- Every phase must be committed only to this branch and GitHub status/checks must be inspected before moving on.

## Current backend dependencies found

### Firebase client
- `lib/firebase.ts` initializes Firebase Auth, Firestore and Firebase Storage.
- Customer login/signup currently uses Firebase Auth (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`).
- Client-side reward/user state still has Firestore listeners in reward-related components.

### Firebase Admin / server
- `lib/firebaseAdmin.ts` provides Admin Auth token verification and Firestore access to protected APIs.
- Server routes use Firestore for catalog, orders, reviews, reseller, rewards and Salaar conversation state.

## Firestore data inventory found

### Storefront / catalog
- `products`
- `categories`
- `settings` (`main`, `general`, `reseller` documents are referenced)
- `prime_skills`

### Orders / reviews
- `orders`
- `reviews`

### Rewards
- `reward_gifts`
- `user_rewards`
- `reward_redemptions`

### Reseller Club
- `reseller_profiles`
- `reseller_withdrawals`
- `reseller_reward_ledger`
- `reseller_task_claims`
- `reseller_point_ledger`
- `reseller_task_events`
- `reseller_whatsapp_orders`

### Salaar
- `salaar_conversations`
- nested `salaar_conversations/{sessionId}/messages`

## Dual-database policy by domain

### Catalog / categories / settings / Prime Skills
- Supabase primary after cutover.
- Firebase synchronized mirror.
- Safe for dual-write from protected admin/server paths.
- Emergency read fallback to Firebase is allowed if Supabase read fails and mirrored data is known current.

### Product images
- Cloudflare R2 stays authoritative for image files.
- Both databases store only the same image URL strings.
- No image binary duplication into Supabase or Firebase is required.

### Orders
- Must have one authoritative write path at a time.
- During transition, create the authoritative order once, then mirror asynchronously/idempotently to the secondary database using the same order ID.
- Never independently create two orders from one checkout request.
- Order mirror failures must be observable/retryable and must not charge or credit twice.

### Reviews
- Preserve deterministic orderId + productId uniqueness.
- Primary write once, secondary mirror idempotently using the same review ID.
- Read fallback may use the mirror only after data parity is established.

### Reseller wallets / rewards / withdrawals / points
- Never active-active write balances in both databases.
- Supabase will become authoritative after cutover because Postgres transactions/constraints are suited to ledger integrity.
- Firebase receives an idempotent mirror/backup after the authoritative transaction succeeds.
- Wallet balances are derived/updated only by the authoritative transaction path; fallback database must never independently release the same reward or withdrawal.

### Salaar
- Conversation/message persistence can be mirrored using stable session/message IDs.
- WAIT/HARD/SOFT/NEED YOU/Ready/Complete state needs a single authoritative state transition path.
- Emergency chat can continue in degraded mode if persistence is unavailable, but must not fabricate saved order/hold state.

### Authentication
- Firebase Auth currently owns customer/reseller identity and UID relationships.
- Auth migration is delayed until Phase 6.
- Existing Firebase UIDs must be preserved in mapping fields so reseller profiles, rewards, orders and ledgers remain linked.
- Firebase Auth remains available during the migration; no user account is deleted in early phases.

## Important behavior to preserve

### Products / catalog
- Product IDs are used by `/product/[id]`, orders, reviews, Salaar cards and weekly deal settings.
- Product records include pricing, images, variants/variantMatrix, stock, category/categoryId and deal-related fields.
- Categories normalize `imageUrl` / `iconUrl`.
- Weekly deal settings can reference product IDs.

### Orders
- Order creation re-reads authoritative product records before accepting price/stock.
- Existing order records include customer, items, subtotal/discount/delivery/total, reseller linkage, status, timestamps and source.
- Reseller tier discount depends on `reseller_profiles` + `settings/main`.

### Reviews
- Reviews are tied to an existing order and purchased product.
- Existing review document ID is deterministic from orderId + productId; preserve uniqueness during migration.

### Reseller
- Firebase Auth UID is currently the key for `reseller_profiles` and related ledger rows.
- Wallet/reward/withdrawal/task flows use transactions and increments; Supabase design must preserve atomicity and ledger integrity.
- WhatsApp reseller requests are stored separately in `reseller_whatsapp_orders`.

### Salaar
- Conversation state supports AUTO / WAIT, HARD/SOFT hold, pending message, NEED YOU and Ready/Complete flows.
- Messages are currently a nested subcollection; Supabase schema should use normalized conversation/message tables with indexed `session_id` and timestamp.

## Cloudflare image audit
- Current product upload route uses Cloudflare R2 for product image files.
- R2 public base defaults to `https://images.primehubmall.com`.
- Images are compressed to WebP and stored under `products/...` keys.
- Migration preserves image URL strings only; image binaries do not move to Supabase.

## Supabase starting state
- Connected project: `primehubpk's Project` (`odigelpzdmhkipfetian`).
- Region: `ap-southeast-1`.
- Status observed: `ACTIVE_HEALTHY`.
- No PrimeHub business tables existed in the public schema at the initial audit, so Phase 2 can create a clean schema.

## Phase 2 handoff
Phase 2 will create the Supabase schema/security model while Firebase stays untouched and active. It will include:
- catalog/settings/Prime Skills tables designed for stable IDs and mirrored writes;
- orders/order-items with idempotency keys and same-ID mirror support;
- reviews with order/product uniqueness;
- reseller/reward/wallet ledgers with constraints and transaction-safe functions;
- Salaar conversations/messages/state with stable IDs;
- Firebase UID mapping fields for identity continuity;
- indexes for storefront/admin reads;
- Row Level Security plus server-only write paths for sensitive operations;
- migration metadata/outbox fields needed for safe retryable Firebase mirroring.

No Firebase data is deleted or switched off in Phase 2.
