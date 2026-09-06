# Supabase Migration — Phase 1 Audit

Status: COMPLETE (audit only; no production cutover)

Branch: `feature/supabase-migration`
Base main commit: `0972aea6a257abafe94a9fbc7626554f764f494d`

## Guardrails
- Do not merge to `main` until Phase 7 is complete and final checks pass.
- Do not remove Firebase yet; keep it as rollback source until cutover is verified.
- Keep Vercel hosting and current UI/routes unchanged.
- Keep Cloudflare R2 image storage and existing `images.primehubmall.com` URLs unchanged.
- Migrate data layer in controlled phases; preserve existing document IDs where they are referenced by URLs/orders/relations.

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

## Important behavior to preserve

### Products / catalog
- Product IDs are used by `/product/[id]`, orders, reviews, Salaar cards and weekly deal settings.
- Product documents contain pricing, images, variants/variantMatrix, stock, category/categoryId and deal-related fields.
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
- Wallet/reward/withdrawal/task flows use transactions and increments; Phase 2 schema must preserve atomicity and ledger integrity.
- WhatsApp reseller requests are stored separately in `reseller_whatsapp_orders`.

### Salaar
- Conversation state supports AUTO / WAIT, HARD/SOFT hold, pending message, NEED YOU and Ready/Complete flows.
- Messages are currently a nested subcollection; Supabase schema should use normalized conversation/message tables with indexed `session_id` and timestamp.

## Cloudflare image audit
- Current product upload route uses Cloudflare R2, not Firestore, for product image files.
- R2 public base defaults to `https://images.primehubmall.com`.
- Images are compressed to WebP and stored under `products/...` keys.
- Migration must only preserve image URL strings in product/category/review records; image binaries do NOT need migration to Supabase.

## Supabase starting state
- Connected Supabase project: `primehubpk's Project` (`odigelpzdmhkipfetian`).
- Region: `ap-southeast-1`.
- Project status observed: `ACTIVE_HEALTHY`.
- No PrimeHub business tables existed in the public schema at Phase 1 audit time; schema is clean for Phase 2.

## Phase 2 handoff
Phase 2 will create the Supabase relational schema and security model only. It should include:
- catalog tables and JSONB fields where preserving flexible product/variant structure is safer;
- orders and order_items with existing IDs preserved;
- reviews with order/product uniqueness;
- rewards/reseller ledgers with foreign keys and transaction-safe RPC/functions where needed;
- Salaar conversations/messages/state fields;
- settings/Prime Skills structures;
- indexes for storefront reads and admin workflows;
- Row Level Security policies and server-only write paths for sensitive operations.

No Firebase data will be deleted in Phase 2.
