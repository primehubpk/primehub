# PrimeHub Trusted Web Activity

Android wrapper for https://www.primehubmall.com  
Application ID: `com.primehubmall.app`

## Build a Play Store bundle

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
