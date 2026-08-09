# STEP 13 — Firebase Security + Admin Authentication

## Current security model
- Admin UI login uses Firebase Authentication (email/password).
- Firestore admin authorization uses the exact Firebase Authentication UID configured in `firebase/firestore.rules`.
- `REPLACE_WITH_ADMIN_UID` is intentionally kept as a placeholder until the real admin account exists.
- Never deploy the rules while the placeholder remains.

## Required manual setup
1. Enable Firebase Email/Password Authentication.
2. Create the dedicated admin user.
3. Copy the user's Firebase Authentication UID.
4. Replace `REPLACE_WITH_ADMIN_UID` in `firebase/firestore.rules`.
5. Deploy with `firebase deploy --only firestore:rules`.
6. Sign out/in and verify the admin can manage protected data.

## Order security
Guest checkout is intentionally allowed to create orders. Guests cannot read, update, or delete orders. Admin access is controlled by the configured Firebase Authentication UID.

## Weekly Deals
Weekly Deals remain inside `settings/main.weeklyDeals` from STEP 03. They are therefore covered by the existing `settings` security rule; a separate `weeklyDeals` collection is not used.
