# STEP 16 — YouTube Guide + Policy Pages Admin Control

## Scope
This step adds Admin control for the existing YouTube Guide and customer-facing policy pages only.

## Changes
- Added optional `youtubeGuide` settings to `SiteSettings`.
- Added optional `policies` settings for Privacy Policy, Terms of Service, and Return Policy.
- Added safe defaults in `lib/useSettings.ts` so older `settings/main` documents continue to work.
- Updated `components/YouTubeGuide.tsx` to read its enabled state, title, video ID and description from `settings/main`.
- Updated the three policy routes to read their content from `settings/main` with safe fallbacks.
- Added YouTube Guide and Policy Pages editors to the existing Admin Site Settings screen.
- Existing `settings/main` save path remains unchanged (`setDoc(..., { merge: true })`).
- Existing ImgBB, products, categories, orders, cart, weekly deals and Firebase setup were not migrated or removed.

## Backward compatibility
The new fields are optional. Existing Firestore settings documents remain valid and receive safe UI defaults until an admin saves new content.

## Verification
- Source ZIP inspected before modification.
- No Firebase project/config migration.
- No existing Firestore collection migration.
- No existing feature intentionally removed.
- `npm install` could not complete in the audit environment because the configured package registry returned 404 for `@types/node@20.14.15`.
- Therefore a real dependency-backed `npm run build` could not be certified in this environment.
- Global TypeScript parsing was attempted, but without installed project dependencies it reports missing module/type declarations; this is an environment limitation, not a clean build result.

## Source of truth
After this step, the generated STEP 16 ZIP is the new source of truth only after the user reviews/tests it.
