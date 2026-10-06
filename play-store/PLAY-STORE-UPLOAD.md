# PrimeHub Play Store upload

Package name: `com.primehubmall.app`  
Website: https://www.primehubmall.com  
App wrapper: Trusted Web Activity (same live website, no second backend)

## Files you need

Download the zip from GitHub (this is the working link):

https://github.com/primehubpk/primehub/raw/main/play-store/PrimeHub-PlayStore-Upload.zip

It contains:

- `app-release.aab` — upload this in Play Console
- `keystore/primehub-upload.p12` — keep this forever
- `keystore/keystore-info.txt` — passwords and SHA-256
- listing images for the store page

Do not put the keystore on GitHub or WhatsApp. If this file is lost, you cannot update the same Play Store app.

## Play Console steps (Open testing → production)

You already finished country + testers. Next:

1. Open **Testing → Open testing → Create a new release**
2. Upload `app-release.aab`
3. Release name: `7.0.0`
4. Release notes example:

   ```
   PrimeHub 7.0.0. Meets current Play Store SDK requirements. Shop retail and wholesale products from primehubmall.com.
   ```

5. Save → **Preview and confirm** → send to Google for review
6. After open testing is approved and you want production: **Promote release** to Production, or create a Production release with the same AAB

## Store listing URLs

- Privacy policy: https://www.primehubmall.com/privacy-policy
- Terms: https://www.primehubmall.com/terms
- Account deletion: https://www.primehubmall.com/delete-account
- Website: https://www.primehubmall.com

## After the first upload

Play App Signing creates a second certificate. Open **Setup → App signing**, copy the **App signing key certificate SHA-256**, and add it to `public/.well-known/assetlinks.json` next to the upload-key fingerprint. Until that file is live on the website, Android may show a browser URL bar instead of a full-screen app.

Check this URL after deploy:

https://www.primehubmall.com/.well-known/assetlinks.json
