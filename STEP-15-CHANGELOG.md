# STEP 15 — Weekly Deals — Final Safe Fix

## Final source of truth

Weekly Deals use the **existing STEP 03 Firestore document**:

- Document: `settings/main`
- Field: `weeklyDeals`
- Shape: `WeeklyDeal[]` from `lib/types.ts`

A separate top-level `weeklyDeals` collection is **not used**. STEP 03 already established `settings/main.weeklyDeals`, and creating a second collection would split the data between two sources of truth and could make the live storefront/admin disagree.

## Storefront

- `components/WeeklyDealStrip.tsx` reads `settings/main.weeklyDeals`.
- Cards are ordered Sunday → Saturday.
- Only active deals are shown.
- Today's deal receives the TODAY highlight.
- CTA uses `buttonLink`, with a product-page fallback when `productId` is available.

## Admin

- Existing Site Settings → Weekly Deals UI manages all seven day slots.
- Image upload continues to use the existing ImgBB flow.
- Saving Weekly Deals uses the existing `settings/main` save flow.
- No separate collection writer was added.

## Firebase security

Weekly Deals are protected by the existing `settings/{settingId}` rule because the data lives inside `settings/main`. No extra `weeklyDeals` collection rule is required. Adding one would be incorrect for the current architecture.

**Do not deploy Firestore rules while `REPLACE_WITH_ADMIN_UID` remains in `firebase/firestore.rules`.**

Before deployment:
1. Create the admin user in Firebase Authentication.
2. Copy that user's exact Firebase UID.
3. Replace `REPLACE_WITH_ADMIN_UID` in `firebase/firestore.rules`.
4. Deploy the rules.
5. Sign in to `/admin` with that Firebase Authentication account.
6. Verify admin reads/writes work and anonymous users cannot read/update/delete orders.

## Consistency fixes included in the final Step 15 pass

- Homepage client directive and JSX structure are valid.
- Cart actions use `addItem`, `removeItem`, and `updateQty`; cart IDs support both string and numeric IDs.
- Checkout and Admin Orders use the same order schema/status values.
- Free-delivery threshold uses the shared settings value, with a 5-item fallback.
- Admin authentication uses Firebase Authentication; Firestore authorization is enforced by the configured admin UID.
- Required storefront routes are present.
- Category and price-filter navigation are aligned.

## Live-project safety

This fix does not delete or migrate any existing Firestore documents. It keeps the STEP 03 Weekly Deals data where it already lives and avoids introducing a competing collection.
