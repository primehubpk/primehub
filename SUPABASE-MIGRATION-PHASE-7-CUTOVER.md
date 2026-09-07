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
- Phase 3 initial live Firebase -> Supabase data copy: COMPLETE and verified on 2026-09-07.
- Phase 4 dual read layer: code complete and CI-built.
- Phase 5 dual write/mirror layer: code complete and CI-built.
- Phase 6 auth identity bridge + Salaar dual layer: code complete and CI-built.
- Phase 7 final cutover preparation: complete when final branch CI and preview smoke checks are green.

## Phase 3 completion evidence

The trusted Firebase Admin -> Supabase migration workflow completed successfully on 2026-09-07 at `2026-09-07T08:57:19.433Z`.

Verified Firebase -> Supabase counts:

- products: 506 -> 506
- categories: 14 -> 14
- settings: 5 -> 5
- prime_skills: 5 -> 5
- orders: 3 -> 3
- reviews: 0 -> 0
- reward_gifts: 3 -> 3
- user_rewards: 1 -> 1
- reward_redemptions: 0 -> 0
- reseller_profiles: 2 -> 2
- reseller_withdrawals: 0 -> 0
- reseller_reward_ledger: 0 -> 0
- reseller_task_claims: 0 -> 0
- reseller_point_ledger: 0 -> 0
- reseller_task_events: 0 -> 0
- reseller_whatsapp_orders: 0 -> 0
- salaar_conversations: 11 -> 11
- salaar_messages: 50 -> 50

Additional preservation checks after copy:

- all 506 product rows are marked `authoritative_source=firebase` and `mirror_status=synced`;
- all 506 mapped product image URLs match the original Firebase payload snapshot;
- all 14 category slugs match the original Firebase payload snapshot;
- settings, orders, reseller profiles and Salaar conversation rows carry the expected Firebase source/synced markers;
- Firebase document IDs are preserved by the migration mapper as Supabase primary keys (or the corresponding `user_id` / `session_id` key for those tables);
- Firebase data is not deleted or modified by the migration.

Production Firebase contained duplicate category slugs, which Firestore permits. Supabase's migration schema had an unnecessary unique slug index. Phase 3 therefore replaces that unique index with a normal indexed lookup so source records can be preserved exactly without renaming category slugs.

## Post-Phase-3 environment settings

```env
PRIMEHUB_DATA_READ_MODE=supabase-primary
PRIMEHUB_BACKEND_WRITE_MODE=firebase-primary
```

`PRIMEHUB_DATA_READ_MODE` is the canonical read switch. Runtime keeps backward compatibility with the legacy `PRIMEHUB_BACKEND_READ_MODE` variable during cutover.

This gives the intended first cutover behavior:

- storefront/catalog/settings reads try Supabase first and fall back to Firebase if Supabase read fails;
- financial/order writes remain Firebase-authoritative during stabilization and mirror to Supabase;
- Firebase remains available for rollback/fallback and is not removed.

Server-only secrets required for the final runtime:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The one-time Phase 3 migration runner additionally uses:

```env
FIREBASE_SERVICE_ACCOUNT_KEY=
```

Never expose the service-role key or Firebase service account in client-side/NEXT_PUBLIC variables.

## Final cutover order after Phase 3 is green

1. Re-run GitHub Migration Branch CI and require a green build/type check.
2. Verify the migration branch is not behind `main` or reconcile any new main changes first.
3. Verify Supabase counts/samples again immediately before cutover.
4. Keep `PRIMEHUB_BACKEND_WRITE_MODE=firebase-primary` for the first production deployment so financial/order transactions remain on the known authoritative path while mirrors populate.
5. Set `PRIMEHUB_DATA_READ_MODE=supabase-primary` so verified catalog/settings reads are Supabase-first with Firebase fallback.
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

The old production behavior could show products in Shop while Home displayed an empty-catalog fallback because Shop had a client Firestore retry while Home relied on a cached server snapshot. The dual read layer removes that architectural mismatch by centralizing the backend read/fallback path. This should still be verified in preview/production smoke testing after final deployment.

## Release gate

Phase 3 live data copy and verification are complete. The branch remains gated from merge/production until final CI, branch reconciliation with `main`, and explicit owner approval are complete.
