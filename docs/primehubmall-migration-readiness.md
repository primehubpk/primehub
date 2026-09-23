# Primehubmall performance branch and migration status

Inspected on 2026-09-23. Branch: `fix/primehubmall-egress-performance`.

## Status

Performance changes are prepared for review. **The database migration has not run.**
The connected destination `Primehubmall` (`nmhwwxhanvceznhbrhri`) has no public
tables. The source project (`odigelpzdmhkipfetian`), identified from the existing
Vercel project's Supabase URL, rejects reads through the connected Supabase app
with a permission error. Source access is required before copying or verifying
private data. Production environment variables have not been changed.

Automatic Vercel Git deployments for this exact branch are disabled in
`vercel.json`. No merge, manual deployment, database write, or production cutover
is part of this change. The deployment rule does not disable other branches or
manual deployments. Keep it until migration and production-configured checks
are complete and deployment is explicitly requested.

## Observed usage

The existing Vercel project displayed the following for Aug 24–Sep 23, 2026:

| Meter | Usage / included limit |
| --- | --- |
| Fast Origin Transfer | 8.78 GB / 10 GB |
| Fluid Active CPU | 4 h 41 m / 4 h |
| ISR writes | 199K / 200K |
| Function invocations | 135K / 1M |
| Fast Data Transfer | 6.28 GB / 100 GB |
| Deployment storage | 117.29 MB / 10 GB |
| Image transformations | 5,095 / 5,000 |

The near-full 10 GB meter is origin transfer, not deployment storage. Supabase
egress also measures transferred bytes rather than stored database size. The
reported 7.12 GB source Supabase usage could not be independently inspected.
These totals do not establish which requests, bots, users, or builds caused
the usage. Changes reduce identifiable repeated work; they cannot promise zero
CPU/egress, instant loading on every connection, or reset an existing quota.

## Changes

- Public browser reads now share in-flight requests and a 60-second memory
  cache across mounted components. Failed responses are not cached, requests
  time out, and invalidation prevents older requests from repopulating cache.
- Categories use a categories-only endpoint. Opening the category directory no
  longer prefetches twelve full-catalog pages; user-intent prefetch is retained.
- Catalog recovery no longer launches three closely spaced retries. Public
  product batches use tagged server cache; single purchase-time product checks
  remain fresh. Cart, customer and order data are not put in the public cache.
- Settings use a shared five-minute server snapshot rather than an independent
  fresh backend read. Nested settings providers follow the refreshed parent.
  Admin write events invalidate browser snapshots across same-origin tabs and
  use an uncached response URL. Relevant server tags expire on writes.
- Product pages reuse five-minute cached products. Big Deal uses timed
  revalidation, and sitemap generation reuses the shared Supabase-primary
  catalog rather than rescanning Firestore on every request.
- Big Deal admin reads only storefront settings, not the entire settings
  collection containing chat history. Chat-list polling changes from five to
  thirty seconds, pauses when hidden, and prevents overlapping requests.
- Compact product projections preserve deal prices/day and legacy category
  identifiers required by sale, weekly-deal and category views.
- Existing direct Cloudflare image delivery and unoptimized Next images remain
  in place; this branch does not move images through Vercel transformations.

An admin write refreshes the same browser and same-origin tabs through existing
events. Other customers receive changes on their cache/refresh cycles; this is
not a globally real-time subscription. Out-of-band database changes must also
invalidate tags or wait for timed revalidation. Cache expiry still incurs work.

## Firebase recommendation

Keep Firebase for now. Firebase Auth, reseller flows and several admin paths
still depend on it directly; it is not solely a fallback. Retain Supabase as the
primary data-read mode and Firebase as recovery where already supported. Remove
Firestore only after those remaining dependencies and identity mappings are
migrated and tested. Do not delete the existing Firebase project or source DB.

## Migration gate and procedure

1. Grant the connected Supabase app authorized read/export access to source
   project `odigelpzdmhkipfetian`, or provide an authorized database backup via a
   secure channel. Do not paste service-role keys/passwords into Git or chat.
2. Inventory the actual source: schemas, tables, row counts, constraints,
   sequences, indexes, policies, grants, triggers/functions, extensions, auth
   identities, storage buckets/objects, edge functions, scheduled jobs and
   project configuration. Repository migrations alone do not prove completeness.
3. Capture a recoverable source backup, inventory and checksums. Compare actual
   schema with the six migrations in `supabase/migrations` before applying any
   migration; do not blindly execute historical removal migrations.
4. Restore schema and all authorized data to the empty destination, preserving
   IDs, timestamps, relationships and Firebase UID bridges. Include private
   orders, users/resellers, reviews, rewards, settings and provider-secret records
   where present. Transfer Supabase Storage objects separately if any exist.
   Cloudflare-hosted image URLs stay unchanged; confirm object availability.
5. Preserve or securely re-encrypt Salar credentials. `credentialCrypto.ts`
   derives its key from `SALAR_KEYS_ENCRYPTION_KEY`, falling back to the old
   `SUPABASE_SERVICE_ROLE_KEY`. Simply replacing that service-role key after
   copying ciphertext can make stored provider credentials unreadable. Set a
   dedicated encryption root or re-encrypt using authorized source access;
   never commit keys or ciphertext exports to this public repository.
6. Compare every source/destination table's row count and deterministic content
   checksums, orphan relationships, sequence values and storage counts. Verify
   public/private RLS behavior and absence of anonymous access to private data.
7. Configure a separate, still-disabled Vercel project using the existing
   `.env.example`: destination Supabase URL and keys, existing Firebase Auth/
   admin configuration, R2 configuration, and the preserved Salar encryption
   root. Copy other required project variables securely. Never switch the live
   project to an empty or partially restored destination.
8. With real credentials, complete the production build and check home, shop,
   categories, search, product variants, weekly deals, Big Deal, sale, wholesale,
   skills, rewards, login/reseller identity, settings writes, checkout and order
   creation. Verify price/stock at purchase time and Firebase fallback behavior.
9. Freeze writes briefly or replay a measured final delta before a later
   authorized cutover. Reconcile counts again. Keep the old project available
   for rollback and define how post-cutover writes will be reconciled.
10. Deploy only after review/authorization. Observe request counts, Supabase
    egress, Vercel CPU/origin transfer and ISR writes under the same traffic
    window; inspect request logs for bots or repeated expensive endpoints.

## Validation performed

- TypeScript checking passed.
- Existing and added Node tests passed (25 tests total). Added checks cover
  concurrent public reads, expiry, failure handling, invalidation races,
  categories-only reads, cached product batches versus fresh individual reads,
  response-cache bypass after writes, and invalid request handling.
- Production webpack compilation and its TypeScript stage passed. Full build
  then failed during static page data generation because this workspace has no
  Supabase server credentials or Firebase service account. This is not a fully
  passing production build or an end-to-end migration verification.
- No production traffic benchmark or live destination checkout test has run.

Separate existing launch risk: some admin handlers trust a static admin cookie.
This branch does not redesign authorization. Before public launch, review those
handlers and use server-verified admin identity for privileged reads and writes.
