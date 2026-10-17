# Meta app promotion setup

Android package: `com.primehubmall.app`. This branch prepares versionCode 15 /
versionName 13.0.2 from the released versionCode 14 UI. Icons, navigation, status
bar, push settings, Firebase configuration, and upload signing identity are retained.

## Required account configuration

1. Complete the store owner's Meta for Developers registration, including the
   owner's acceptance of Platform Terms / Developer Policies and any verification.
2. Create the PrimeHub shopping app for app promotion / App Events, owned by the
   PRIMEHUB business portfolio `1103357132556479`.
3. Add Android package `com.primehubmall.app`, activity
   `com.primehubmall.app.MainActivity`, and its real Google Play listing.
4. Assign the registered Meta app to ad account `1094807886514044` and connect
   its App Events source to catalogue `2712878232516326`.
5. Supply the real SDK client configuration at build time:
   `PRIMEHUB_META_APP_ID` and `PRIMEHUB_META_CLIENT_TOKEN`. These are SDK client
   configuration values. Never substitute a Pixel ID, app secret, access token,
   or signing password. No real client values are committed here.

Without both values the SDK and native bridge remain disabled; existing website
Pixel tracking is preserved. Supplying malformed or only partial configuration
fails the build. A debug compile without those values is a compile check, not a
connected app or an install-attribution test.

## Build and verification before promotion

- Run `node --test tests/meta-pixel.test.mjs` and Android assemble/lint checks.
- Build a signed release using the existing upload key and existing protected CI
  signing secrets after Meta client configuration is available. Do not generate a
  replacement key. Do not upload a debug-signed APK over the production app.
- Install the signed release on an owned test phone. Check Events Manager for
  activation/install, product view, AddToCart and InitiateCheckout with real
  catalogue IDs. Verify Purchase only after a real saved order, never a fake sale.
- The SDK uses an origin-restricted main-frame WebMessageListener and accepts only
  standard shopping events. It does not receive contact details, auth tokens,
  addresses, or arbitrary message fields. Advertising ID collection and automatic
  metadata / purchase detection are disabled. App activation is logged explicitly.
- Review the privacy policy and Google Play Data Safety declarations for the new
  Meta analytics SDK before rolling out the new AAB.
- Then select the valid app in the App promotion campaign, verify supported
  product app links and the actual install/purchase performance goal, reset start
  and end dates if needed, and keep the total budget at PKR5,000 for ten days.

Do not describe the current Play Store Traffic draft as optimised app installs or
app purchases. Account registration, linked Meta app, configured signed release,
and live event verification remain release gates.
