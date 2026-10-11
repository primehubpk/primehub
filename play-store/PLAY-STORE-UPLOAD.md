# PrimeHub Play Store upload

Package name: `com.primehubmall.app`  
Website: https://www.primehubmall.com  
App: in-app WebView of the live website (same checkout, login, and shop)

## Files you need

Download the zip from this branch (do not merge until you say so):

https://github.com/primehubpk/primehub/raw/cursor/play-store-bag-icon-launch-4688/play-store/PrimeHub-PlayStore-Upload.zip

It contains:

- `app-release.aab` — upload this in Play Console (versionCode **9**)
- `keystore/primehub-upload.p12` — keep this forever
- `keystore/keystore-info.txt` — passwords and SHA-256
- listing images for the store page (same shopping-bag P as the phone icon)

Do not put the keystore on GitHub or WhatsApp outside this zip. If this file is lost, you cannot update the same Play Store app.

## Play Console steps (Production update)

1. Open **Test and release → Production → Create new release**
2. Upload `app-release.aab` (must be versionCode 9; 8 is already used)
3. Release name: `9.0.0`
4. Release notes example:

   ```
   PrimeHub 9.0.0. Play Store shopping-bag P icon on the phone, and the shop stays open instead of closing after launch.
   ```

5. Save → **Start rollout to Production**

Keep the existing Play Store listing icon. The phone launcher icon now matches it.

## Store listing URLs

- Privacy policy: https://www.primehubmall.com/privacy-policy
- Terms: https://www.primehubmall.com/terms
- Account deletion: https://www.primehubmall.com/delete-account
- Website: https://www.primehubmall.com
