# STEP 13 — Firebase Security Setup

## 1. Enable Email/Password Authentication
Firebase Console → Authentication → Sign-in method → Email/Password → Enable.

## 2. Create the admin account
Authentication → Users → Add user. Use a dedicated admin email and a strong unique password.

## 3. Get the admin UID
Open the Firebase Authentication user and copy its exact UID.

## 4. Replace the placeholder
Open `firebase/firestore.rules` and replace:

`REPLACE_WITH_ADMIN_UID`

with the real Firebase Authentication UID.

## 5. Deploy only after the UID is replaced
From the project root:

`firebase deploy --only firestore:rules`

**DO NOT deploy while `REPLACE_WITH_ADMIN_UID` is present.**

## 6. Verify before calling the project production-ready
- Anonymous user can read products, categories and settings.
- Anonymous user can create an order.
- Anonymous user cannot read, update or delete orders.
- Admin user can read/update/delete protected data.
- Admin login works through Firebase Authentication.

## Weekly Deals note
STEP 03 already stores Weekly Deals in `settings/main.weeklyDeals`. STEP 15 uses that same source of truth. A separate top-level `weeklyDeals` collection is intentionally not used, so no extra collection rule is required.

## Live-project safety
Do not delete or migrate existing `settings/main.weeklyDeals` data as part of this setup. The rules change only controls access; it does not migrate existing documents.
