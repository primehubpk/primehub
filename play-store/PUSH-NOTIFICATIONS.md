# PrimeHub Android push — v10 branch only, NOT released

Base: cursor/play-store-bag-icon-launch-4688 (versionCode 9 WebView; PR #178 stays draft).
New Android app build increments versionCode 10, retains com.primehubmall.app and existing upload signing settings.
NO AAB / keystore is committed by this feature. NEVER use a new upload key.

## Required one-time Firebase configuration
1. Firebase Console > Project settings > Add Android app for existing project with package
   com.primehubmall.app. Register SHA-256 Play App Signing fingerprints when needed.
2. Copy the *Android* app ID (looks like 1:987298121402:android:...).
   Not the web app ID! Set PRIMEHUB_FIREBASE_ANDROID_APP_ID in the local Android build environment.
   The sender ID, project ID and public web Firebase API key are referenced by Android build config.
   If missing, browsing still works and push is disabled, never broken.
3. Rebuild signed AAB **only when release is approved**, with the EXISTING primehub-upload keystore.
   Set the same PRIMEHUB_STORE_FILE / PRIMEHUB_STORE_PASSWORD / PRIMEHUB_KEY_ALIAS /
   PRIMEHUB_KEY_PASSWORD as v9. NEVER commit these secrets or an AAB.
4. Server environment: existing FIREBASE_SERVICE_ACCOUNT_KEY and CRON_SECRET must be set.
   Firebase Admin and FCM must belong to that same Firebase project.

## Data and safety
- Firestore service-account-only collections: push_installations, push_delivery_log.
  No browser direct writes; lock both collections in firestore.rules (default deny).
- Every installation has a random Android-private install ID + secret. API validates SHA-256
  secret for subsequent mutations; browser JS never sees it.
- Register/revoke per device. OS permission + app switch both required.
- No browser Web Push, no tracking permission, location, SMS or contacts permissions.
- Native-origin-scoped AndroidX WebMessageListener provides view and purchase events.
- Existing checkout acknowledges a created order before telling the native app;
  push device endpoint checks order exists before recording a purchase.
- One message per slot per device per Pakistan calendar day; Firestore create-only
  delivery receipts make cron retries idempotent. No content = no notification.
- Only previously opened devices may receive the browse follow-up.
- Image is a real trusted HTTPS product image. No fake scarcity or stale arrivals.
- Manual sends / unrestricted test blasts are deliberately absent.

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
