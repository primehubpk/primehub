# PrimeHub Android push — v10 branch only, NOT released

Base: cursor/play-store-bag-icon-launch-4688 (versionCode 9 WebView; PR #178 stays draft).
New Android app build increments versionCode 10, retains com.primehubmall.app and existing upload signing settings.
NO new AAB / keystore is committed by this feature. NEVER use a new upload key.
WARNING: A legacy repository upload ZIP appears to contain a keystore; treat that
archive as sensitive. Protect/remove it from public access and discuss an upload
key reset with Google Play if key material has been exposed.

## Required one-time Firebase configuration
1. Firebase Console > Project settings > Add Android app for existing project with package
   com.primehubmall.app. Register SHA-256 Play App Signing fingerprints when needed.
2. Copy the *Android* app ID (looks like 1:987298121402:android:...).
   Not the web app ID! Set PRIMEHUB_FIREBASE_ANDROID_APP_ID in the local Android build environment.
   The sender ID and project ID remain fixed to the existing Firebase project. Set
   PRIMEHUB_FIREBASE_ANDROID_API_KEY using the Android client's key from
   google-services.json (not the website key). Release bundling fails closed if
   either Android App ID or Android API key is missing.
   Android PrimeHubApplication initializes Firebase for background FCM delivery even if
   the WebView has not been opened in the current process.
   If missing in a local debug build, browsing still works and push is disabled.
   A versionCode 10 release AAB is blocked unless Android Firebase config and
   existing v9 signing parameters are provided.
3. Rebuild signed AAB **only when release is approved**, with the EXISTING primehub-upload keystore.
   Set the same PRIMEHUB_STORE_FILE / PRIMEHUB_STORE_PASSWORD / PRIMEHUB_KEY_ALIAS /
   PRIMEHUB_KEY_PASSWORD as v9. NEVER commit these secrets or an AAB.
4. Server environment: existing FIREBASE_SERVICE_ACCOUNT_KEY and CRON_SECRET must be set.
   Firebase Admin and FCM must belong to that same Firebase project.

## Build verification status
The branch-only GitHub Actions workflow runs Node unit tests, TypeScript checks,
and a debug Android compile. Its debug APK is published as a 7-day CI artifact. It never uploads to Play, signs a release,
or publishes to production. Signed release bundles require the same v9 signing
key and matching upload certificate, the Android Firebase App ID, and physical
phone validation before a delivery artifact can be approved.

## Data and safety
- Firestore service-account-only collections: push_installations, push_delivery_log.
  No browser direct writes; lock both collections in firestore.rules (default deny).
  Enable the Firestore TTL policy on `expiresAt` for push_delivery_log and
  push_user_purchases to prune 90-day-old dedupe/purchase markers automatically.
  Do not activate these settings on production until release is approved.
- Every installation has a random Android-private install ID + secret. Its private
  SharedPreferences file is excluded from Android cloud backup and device transfer. API validates SHA-256
  secret for subsequent mutations; browser JS never sees it.
- Register/revoke per device. OS permission + app switch both required.
- No browser Web Push, no tracking permission, location, SMS or contacts permissions.
- Native-origin-scoped AndroidX WebMessageListener provides view and purchase events.
- Existing checkout acknowledges a created order before telling the native app;
  push device endpoint checks order exists before recording a purchase.
- One message per slot per device per Pakistan calendar day; Firestore create-only
  delivery receipts make cron retries idempotent. Authenticated users share a
  per-user slot key across their installations. Purchase suppression is cross-device for
  registered app accounts (including their signed-in website orders); guest purchase suppression remains device-local. No content = no notification.
- Only previously opened devices may receive the browse follow-up.
- Image is a real trusted HTTPS product image. No fake scarcity or stale arrivals.
- Manual sends / unrestricted test blasts are deliberately absent.

## Branch-only signed test bundle (no Play upload)
The feature-branch [v10-signed-artifact workflow](https://github.com/primehubpk/primehub/actions/workflows/v10-signed-artifact.yml)
reads passwords from GitHub Actions Secrets named
`PRIMEHUB_V9_UPLOAD_STORE_PASSWORD` and `PRIMEHUB_V9_UPLOAD_KEY_PASSWORD`.
Set them in GitHub → repository Settings → Secrets and variables → Actions →
New repository secret. Never put passwords in workflow YAML, Git commits,
issues, screenshots or uploaded test artifacts.

When both exist, the **next push on the feature branch** triggers a guarded build:
extract the original v9 upload keystore from the repository legacy ZIP in the
runner only; check its SHA-256 certificate against the registered Play v9
upload certificate; make a signed versionCode 10 AAB ZIP and a signed
phone-test APK; verify the generated AAB certificate, and upload a 7-day
GitHub Actions artifact. It does NOT upload to Play or merge to main.

## Preview phone test before main merge
The Android debug build can open a manually created Vercel preview instead of
production **only** when `PRIMEHUB_PUSH_PREVIEW_ORIGIN=https://...vercel.app`
is set in its build environment. Otherwise it opens current production website.
In contrast, release v10 ALWAYS opens `https://www.primehubmall.com` and cannot
be redirected by this variable. The debug app uses Android debug signing;
it cannot be installed over an existing Play-signed v9, so use a spare
physical phone without that package or uninstall the test copy only.

Preview API registration marks installs `environment=preview`; production cron
ignores them. The protected `GET /api/notifications/cron?period=morning&dryRun=1`
(or `evening`) previews real selections, including purchased-user suppression,
without sending a message. It requires CRON_SECRET on the preview environment.

For one controlled real FCM notification on a PREVIEW device, POST to
`/api/notifications/test` with `Authorization: Bearer $CRON_SECRET` and JSON
`{"installationId":"UUID_FROM_IN_APP_SETTINGS","slot":"big"}`. Slots allowed:
`browse`, `big`, `live`, `arrivals`. Never accepts broadcast requests, never
sends from a production environment, and permits only one test per slot per
preview install per Pakistan calendar day. Only actual eligible products/deals
can be sent. The target must have both Android permission and Settings ON.

A fresh Vercel preview deployment and a test phone are required; the current
production site does NOT contain this branch-only Settings page. Verify preview
access controls (Vercel SSO may block an unauthenticated Android WebView).

## Cron
Vercel cron: /api/notifications/cron?period=morning at 06:00 UTC = 11:00 Asia/Karachi,
and period=evening at 17:00 UTC = 22:00 Asia/Karachi.
Vercel automatic prod cron only executes once code is merged and deployed.
A Hobby cron may not execute at the exact minute; verify your Vercel plan.
The endpoint checks production and the Pakistan hour before sending.

## Safe testing (no customer sends)
- Inspect dry run after protected preview build:
  curl -H "Authorization: Bearer $CRON_SECRET" \
    'https://PREVIEW_HOST/api/notifications/cron?period=morning&dryRun=1'
  Repeat for period=evening. Look for skip/candidate counts and real image URLs.
  The dry run creates **no delivery records** and sends **no FCM messages**.
- On a development phone, build v10 with a valid Android Firebase App ID.
  Browse 2 pages, spend 30s; the Android system permission appears once, NOT on launch.
- Visit /settings/notifications in the Play-style WebView and toggle OFF; confirm
  push_installations.enabled=false; check Android Settings for denied permission.
- For real integration testing after controlled release, use a test-only device and
  a configured staging scheduler, or wait for the next 11:00 / 22:00 PKT cron.
  Do not call the send endpoint with manual overrides on production.
- Confirm a real Big Deal with image expands into Android BigPicture style;
  notification tap must open MainActivity with the target website URL inside WebView.
- Place a real test order before 11:00. Verify browse slot is skipped for that install.
  Unavailable or inactive deals, zero stock and older arrivals must skip.

## Release gates (not completed)
- Android compile/physical-device tests + Play signing verification.
- Correct Android Firebase app ID provided in secure build environment.
- Full server compile and protected preview with FIREBASE_SERVICE_ACCOUNT_KEY.
- Product owner explicitly approves merge to main and Play Store AAB upload.
