# PrimeHub Android app

Android wrapper for https://www.primehubmall.com  
Application ID: `com.primehubmall.app`  
minSdk 24 · targetSdk 36 · versionCode 11 (single Play release candidate; v10 not uploaded)

The Play listing icon (red shopping-bag with P) is the launcher icon. The app
opens the live website inside the PrimeHub activity so it stays on screen
instead of handing off to Chrome and closing.

## Build a Play Store bundle (only after release prerequisites are verified)

Set the matching Firebase Android App ID from Firebase Console:

```bash
export PRIMEHUB_FIREBASE_ANDROID_APP_ID='1:987298121402:android:<your-actual-app-id>'
```

Without this value, shopping stays functional but push is disabled. Follow ../PUSH-NOTIFICATIONS.md for testing.

```bash
export ANDROID_HOME=/path/to/android-sdk
export JAVA_HOME=/path/to/jdk-17-or-21
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > local.properties

export PRIMEHUB_STORE_FILE=/secure/path/primehub-upload.p12
export PRIMEHUB_STORE_PASSWORD='...'
export PRIMEHUB_KEY_ALIAS=primehub-upload
export PRIMEHUB_KEY_PASSWORD="$PRIMEHUB_STORE_PASSWORD"

./gradlew bundleRelease
```

The signed AAB is written to `app/build/outputs/bundle/release/app-release.aab`.
