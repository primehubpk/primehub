# PrimeHub Android app

Android wrapper for https://www.primehubmall.com  
Application ID: `com.primehubmall.app`  
minSdk 24 · targetSdk 36 · versionCode 10 (notification feature branch only)

The Play listing icon (red shopping-bag with P) is the launcher icon. The app
opens the live website inside the PrimeHub activity so it stays on screen
instead of handing off to Chrome and closing.

## Build a Play Store bundle (only after owner authorizes release)

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
