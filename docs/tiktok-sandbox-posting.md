# TikTok sandbox posting integration

This is an internal sandbox test for `@primehubpk1`. It does not provide public publishing or production approval. TikTok's Direct Post audit guidelines say an uploader restricted to owner or team accounts is not an acceptable production use case. Do not submit this as a public creator platform demo.

## Server configuration

Set these in the website's **production Vercel environment**, not in GitHub or client-side variables:

- `TIKTOK_SANDBOX_CLIENT_KEY`: sandbox client key from TikTok Developer Portal.
- `TIKTOK_SANDBOX_CLIENT_SECRET`: sandbox client secret from TikTok Developer Portal.
- `TIKTOK_POSTING_ADMIN_PIN`: unique random secret of at least 16 characters, distinct from the existing website admin password. Treat the current admin password as compromised and rotate it before connecting TikTok.
- Existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SALAR_KEYS_ENCRYPTION_KEY` configure the existing encrypted `integration_secrets` store. Keep encryption key stable to preserve refresh tokens.

In the sandbox configuration, enable Login Kit and Content Posting API / Direct Post, select `user.info.basic` and `video.publish`, add the `@primehubpk1` test user, and register the exact redirect URI `https://www.primehubmall.com/api/tiktok/oauth/callback`. The `www.primehubmall.com` URL property must be verified. The callback is fixed to the production host; preview deployments can show the UI but cannot complete the OAuth redirect.

The separate TikTok Events API token already on the admin page is for Pixel events and **cannot** authorize posting. The sandbox posting credentials and user refresh token are encrypted in a separate `integration_secrets` row.

## Real test and demo

1. Open `/admin/tiktok`, enter the new TikTok posting admin PIN, and click **Connect TikTok**. Approve `video.publish` as `@primehubpk1`.
2. Enter the PIN again after returning from TikTok and click **Check account**. Confirm that the displayed username is `primehubpk1`.
3. Supply an original MP4 or MOV video accessible over HTTPS on `www.primehubmall.com`. The sandbox test form accepts a URL on this verified domain, because TikTok pulls server-hosted media from a verified URL property. It does not upload a local file to the website.
4. Play the preview, enter an editable caption, select **Only me** privacy, choose available interaction settings, mark own-brand promotion when appropriate, and explicitly consent to posting. Click **Post privately to TikTok** and check the publish status.
5. Record the actual browser interaction including login/consent, preview, posting options, response and TikTok result. TikTok's review upload accepts MP4/MOV up to 50 MB per video. Recording a mock screen or claiming public posting in the sandbox is inaccurate.

Public Direct Post needs a genuinely available creator-facing service, required posting controls, actual sandbox demonstration and TikTok's review of the `video.publish` scope. It is not a toggle on this internal tool.

Official references: https://developers.tiktok.com/docs/en/content-posting-api-get-started and https://developers.tiktok.com/docs/en/content-sharing-guidelines and https://developers.tiktok.com/docs/en/login-kit-web
