# Primehubmall migration and performance readiness

Updated 2026-09-24. Branch: `fix/primehubmall-egress-performance`.

## Current status

The destination Supabase project `Primehubmall` (`nmhwwxhanvceznhbrhri`) now has the
same 31 public application tables as the source project
`odigelpzdmhkipfetian`. The current source application data has been restored,
including products, categories, orders, settings, reseller data, rewards, Salar
conversation/brain records, TikTok/integration credentials and the encrypted
Salar provider-secret envelope.

At the final application-data verification point, the source and destination
contained 749 non-empty-table rows in total. Counts matched for every populated
application table, including 622 products, 14 categories, 4 orders, 9 settings,
50 legacy Salaar messages, 18 user reward rows and the private secret records.
Schema columns, primary/unique/check constraints, indexes and public RLS read
policies were also compared with the source. Supabase Auth users and Supabase
Storage objects were empty on the source, so there was no Auth/Storage user data
to transfer.

Two product rows can produce different raw textual row hashes because PostgreSQL
numeric/JSON textual representation is not a stable cross-project checksum.
Their parsed field values were compared directly and matched. IDs and row counts
also match. Use value-aware comparisons rather than raw `row_to_json(... )::text`
hashes for the final pre-cutover delta check.

No production environment has been switched to the destination. The branch is
not merged and automatic Vercel Git deployment for this branch remains disabled.

## Root cause found

Retained Supabase query statistics showed repeated large reads even without real
customer traffic: the full settings table had been read about 22,435 times and
the products table about 6,590 times. Vercel usage for Aug 24-Sep 23 also showed
origin transfer, CPU and ISR writes close to their included limits. This explains
why admin/testing traffic alone could consume significant quota.

The branch therefore reduces repeated backend work rather than simply moving the
same request pattern to a fresh account.

## Performance changes on this branch

- Public browser reads share in-flight requests and short browser memory caching.
- Public catalog/settings server reads use tagged timed caches instead of repeated
  fresh Supabase/Firebase reads.
- Categories use a categories-only path instead of prefetching many full catalog
  pages.
- Product detail pages reuse cached public product data, while checkout/purchase
  checks remain fresh.
- Big Deal, sitemap and storefront settings avoid unnecessary full scans.
- Admin chat list polling is slower, pauses when hidden and blocks overlapping
  requests.
- Salar admin chat listing now stores/uses a compact list summary so normal list
  refreshes do not download full conversation histories and image/product arrays.
  Legacy chat rows keep a compatibility fallback; opening a chat still loads its
  full private history.
- A closed Salar widget now uses a tiny public status endpoint for only
  enabled/icon state. It no longer uses the dynamic customer-chat endpoint while
  closed. Actual chats remain private and uncached.
- Direct Cloudflare/R2 image delivery remains in place; this branch does not
  route catalog images through Vercel image transformations.
- Customer/order/private data is not put in public caches.
- Admin writes continue to invalidate the relevant public cache tags.

These changes reduce unnecessary origin/Supabase work. They do not guarantee zero
egress/CPU and should be measured after the new Vercel project is configured.

## Firebase decision

Keep Firebase for the first cutover. Firebase Auth and some reseller/admin flows
still depend on it directly, so removing it now would mix a backend migration
with an authentication migration. Supabase remains the primary data-read mode and
Firebase remains the compatibility/fallback path where the existing code expects
it. Remove Firebase only as a separate, tested migration.

## Salar credential requirement

`salar_provider_secrets` stores an encrypted envelope. The encryption code uses
`SALAR_KEYS_ENCRYPTION_KEY` when present and otherwise falls back to
`SUPABASE_SERVICE_ROLE_KEY`.

A new Supabase project has a different service-role key. Therefore the new Vercel
project must receive the same dedicated `SALAR_KEYS_ENCRYPTION_KEY` that was
used to seal the provider credentials, or the provider credentials must be
re-entered/re-encrypted from the admin UI before old infrastructure is removed.
Never commit this value to GitHub and never paste it into chat.

The branch now documents `SALAR_KEYS_ENCRYPTION_KEY` in `.env.example`.

## Security/performance advisor notes

The destination has RLS enabled on private tables. Supabase reports informational
"RLS enabled but no policy" notices for private server-only tables; that means
anonymous/authenticated Data API users receive no row access, which is the
intended fail-closed state. The public catalog/settings tables retain explicit
read-only RLS policies matching the source.

Supabase also reports many "unused index" notices. The destination is fresh, so
those indexes have not had production traffic yet. They mirror source indexes and
should not be removed merely because their usage counters are currently zero.

## Remaining cutover gate

Before the old accounts are closed:

1. Configure the new Vercel project with the destination Supabase URL/publishable
   key/service-role key, the stable Salar encryption root, existing Firebase
   Auth/Admin values, R2 credentials, admin password and other required server
   variables.
2. Run a production-configured build and smoke-test home, shop, categories,
   search, product variants, weekly deals, Big Deal, Sale Mela, wholesale,
   rewards, Salar, login/reseller, admin settings, checkout and order creation.
3. Freeze writes briefly (or replay a measured final delta), then re-compare the
   source/destination table counts and values so no change made during migration
   is missed.
4. Only after explicit approval, merge the branch and deploy the new Vercel
   project. Observe Supabase egress and Vercel origin transfer/CPU/ISR during the
   first live window.

## Validation already completed

Before the final migration continuation, TypeScript checking and the existing plus
added Node tests passed (25 tests total), and production webpack/TypeScript
compilation passed. The full build had previously stopped at static data loading
because that workspace did not have production credentials.

After the final continuation, the destination schema/data was re-inspected and
the last performance patches were committed to the branch. No Vercel deployment
or production cutover was triggered while making these changes.

Separate launch risk: some existing admin handlers still rely on the legacy
admin-session design. This migration branch does not redesign the whole admin
authorization model; that should be hardened as a separate launch-security task
rather than mixed into the database move.
