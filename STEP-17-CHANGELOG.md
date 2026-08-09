# STEP 17 — Firebase Auth + Firestore Security Rules

## Implemented

- Kept Firebase Authentication email/password as the Admin sign-in method.
- Added an Admin UID authorization gate to the Admin UI.
- A valid Firebase login no longer automatically unlocks the Admin panel.
- Added the same UID authorization check to the existing `AdminAuthGuard` helper so it cannot bypass the intended Admin authorization if reused later.
- Kept Firestore rules on the existing collections: `products`, `categories`, `settings`, and `orders`.
- Kept guest order creation behavior unchanged.
- Centralized the rules' Admin UID placeholder in `adminUid()`.
- Added setup instructions for the exact UID required before rules deployment.

## REQUIRED BEFORE DEPLOYMENT

1. Create/confirm the Firebase Authentication Admin account.
2. Copy its exact Firebase UID.
3. Replace `REPLACE_WITH_ADMIN_UID` in `firebase/firestore.rules`.
4. Set `NEXT_PUBLIC_FIREBASE_ADMIN_UID` to the same UID in the deployment environment.
5. Do NOT deploy Firestore rules while the placeholder remains.
6. Test Admin login and protected Firestore operations.

## Preserved

- Firebase project/config
- ImgBB upload
- Products
- Categories
- Orders
- Settings
- Cart
- Weekly Deals in `settings/main.weeklyDeals`
- Step 16 YouTube Guide and Policy Pages Admin control

## Verification limitation

The supplied project ZIP does not include `node_modules`, and dependency installation/build could not be completed in this environment because the registry returned a 404 for the pinned `@types/node@20.14.15`. Therefore a dependency-backed `npm run build` is **not certified PASS** by this step.
