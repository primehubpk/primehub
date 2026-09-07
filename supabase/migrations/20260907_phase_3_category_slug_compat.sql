-- PrimeHub Phase 3 migration compatibility.
-- Firestore allows duplicate category slugs; production data contains them.
-- Preserve Firebase records exactly and keep slug indexed for lookup without
-- imposing a uniqueness rule that did not exist in the source datastore.

drop index if exists public.categories_slug_uq;

create index if not exists categories_slug_idx
  on public.categories (slug)
  where slug is not null and slug <> '';
