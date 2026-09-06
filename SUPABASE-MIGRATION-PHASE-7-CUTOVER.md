# PrimeHub Dual Backend Migration — Phase 7 Cutover Readiness

Branch: `feature/supabase-migration`

## Locked architecture

- Supabase is the intended primary database after final cutover.
- Firebase remains synchronized backup/fallback.
- Cloudflare R2 remains the image origin; image URLs are preserved.
- Firebase Auth remains authoritative during the first cutover. User identity is mirrored to Supabase via `auth_identity_map`.
- Financial/order state must never be independently calculated in both databases. Authoritative transaction first, idempotent mirror second.
- Salaar state transitions remain authoritative in Firebase for the first cutover and mirror to Supabase.

## Current migration status

- Phase 1 audit: complete.
- Phase 2 Supabase schema/security: complete.
- Phase 3 initial live Firebase -> Supabase data copy: PENDING.
- Phase 4 dual read layer: code complete and CI-built.
- Phase 5 dual write/mirror layer: code complete and CI-built.
- Phase 6 auth identity bridge + Salaar dual layer: code complete and CI-built.
- Phase 7 final cutover preparation: complete when this checklist and final CI are green.

## HARD BLOCKER before merge/cutover

Do not switch either backend mode to `supabase-primary` and do not merge/deploy this branch until Phase 3 has been run successfully and verified.

Required Phase 3 evidence:

1. One-time migration workflow succeeds with trusted credentials.
2. Firebase and Supabase collection/table counts are compared.
3. Representative product, category, settings, order, reseller, reward and Salaar records are sampled.
4. Existing Firebase document IDs are preserved in Supabase.
5. Cloudflare image URLs remain unchanged.
6. No partial-copy errors remain unresolved.

## Safe environment defaults before Phase 3

```env
PRIMEHUB_BACKEND_READ_MODE=firebase-primary
PRIMEHUB_BACKEND_WRITE_MODE=firebase-primary
```

These defaults keep the current Firebase behavior authoritative while Supabase mirroring/fallback code is staged.

Server-only secrets required for the final runtime:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Phase 3 migration runner additionally requires:

```env
FIREBASE_SERVICE_ACCOUNT_KEY=
```

Never expose the service-role key or Firebase service account in client-side/NEXT_PUBLIC variables.

## Final cutover order after Phase 3 is green

1. Re-run GitHub Migration Branch CI and require a green build/type check.
2. Verify the migration branch is not behind `main` or reconcile any new main changes first.
3. Verify Supabase counts/samples again immediately before cutover.
4. Keep `PRIMEHUB_BACKEND_WRITE_MODE=firebase-primary` for the first production deployment so financial/order transactions remain on the known authoritative path while mirrors populate.
5. Set `PRIMEHUB_BACKEND_READ_MODE=supabase-primary` only after migrated catalog/settings data is verified.
6. Deploy/merge only with explicit owner approval.
7. Run production smoke checks: Home, Shop, category, product detail, search, settings, account login/signup, website order, review, reseller flows, Salaar normal chat, WAIT, Continue, NEED YOU, READY and Complete.
8. Compare Firebase/Supabase mirrored records after smoke tests.
9. Only after write-mirror evidence is clean should a later controlled change consider Supabase-primary writes.

## Rollback

Fast rollback does not require deleting Supabase data.

- Set reads back to `firebase-primary`.
- Keep writes `firebase-primary`.
- Leave Supabase tables/mirror data intact for investigation.
- Do not delete Firebase during the stabilization period.

## Home vs Shop note

The old production behavior could show products in Shop while Home displayed an empty-catalog fallback because Shop had a client Firestore retry while Home relied on a cached server snapshot. The dual read layer removes that architectural mismatch by centralizing the backend read/fallback path. This should still be verified in production smoke testing after final deployment.

## Release gate

Phase 7 code/preparation can be marked complete with green CI, but the migration is **NOT READY TO MERGE/DEPLOY** until Phase 3 live data copy and verification are complete.
