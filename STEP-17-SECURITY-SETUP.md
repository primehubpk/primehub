# STEP 17 — Firebase Auth + Firestore Security Rules

## What changed

- The Admin panel continues to use Firebase Authentication email/password.
- A signed-in Firebase user is now allowed into the Admin UI only when their UID matches the configured admin UID.
- Firestore Rules use the same admin UID allowlist.
- Existing `products`, `categories`, `settings`, and `orders` rules are preserved.
- Guest order creation remains allowed as in the existing project.
- No new `weeklyDeals` collection was introduced; Weekly Deals remain inside `settings/main.weeklyDeals`.

## Required before production rules deployment

1. Create/confirm the Firebase Authentication admin account.
2. Copy that user's exact Firebase UID.
3. Replace `REPLACE_WITH_ADMIN_UID` in `firebase/firestore.rules` with that exact UID.
4. Set `NEXT_PUBLIC_FIREBASE_ADMIN_UID` in the deployment environment to the same exact UID.
5. Do NOT deploy rules while `REPLACE_WITH_ADMIN_UID` is still present.
6. Test Admin login, settings/product/category/order access, and unauthorized-user denial.

## Important

The Firebase Web configuration remains unchanged. Do not put an email password or private server secret into `NEXT_PUBLIC_FIREBASE_ADMIN_UID`; it is only an authorization identifier.

This step does not migrate Firestore data and does not change the existing ImgBB upload system.
