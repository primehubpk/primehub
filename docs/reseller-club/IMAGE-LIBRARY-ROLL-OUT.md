# PrimeHub Reseller Image Library — branch implementation

Branch: `feature/reseller-wallet-admin-dupes-oct14`. DO NOT MERGE OR DEPLOY without owner approval.

## Shopper UX

- Homepage `My Orders → Images → Shop → Cart` (same icon also on standard/header routes).
- Clicking Images opens `/download-images`. If not signed in, it goes to the existing **/reseller/join?redirect=/download-images** page; no second Auth provider / password database / popup is added.
- Already-signed-in active resellers skip the login prompt.
- Firebase Auth token and active `reseller_profiles/{uid}` status are verified when fetching the catalog manifest. The original photo URLs are publicly accessible already on the storefront; downloading their bytes directly from R2 requires no new per-image Firebase or Vercel function request.
- The page displays active category cards, search, category image thumbnails, 36 photos/page and Load more.
- Each photo is downloadable individually with its catalog-derived safe filename.
- **One tap on a category tile** selects that category and starts downloading every original photo as a separate image file; the Download All button can be used to retry. No ZIP archives, extraction step or fixed-size packs. The browser may ask to allow automatic multiple downloads; websites cannot bypass that Chrome protection.
- Images include cover, gallery and variant photos, deduplicated by URL, with no demo content.
- Each original JPG/PNG/WebP file is offered individually to the **Chrome Downloads** destination (not guaranteed to appear instantly inside Android Gallery). Chrome may block additional automatic downloads until the user approves its site permission. Browsers do not disclose whether every requested file actually landed on storage; UI says requested/sent, never falsely confirms disk writes. Native Android WebView DownloadManager behavior must be tested separately.

## Performance and safety

- Reuses the **existing full public storefront catalog cache** (Supabase primary / Firebase fallback). No second full product query; image URLs/variant lists are reused from the cached snapshot, invalidated by `public-catalog`. Only active resellers can retrieve the gallery manifest.
- Listing paginated, thumbnail image requests are directly against Cloudflare R2/ImgBB, not Vercel.
- Image bytes are downloaded **DIRECTLY from Cloudflare R2** (`images.primehubmall.com` / linked `r2.dev`) with browser-side `fetch` + Blob. The 9 legacy ImgBB product images are attempted directly against ImgBB. There is **NO image-binary endpoint, Vercel fallback or R2 proxy**; if CDN CORS is disabled downloads show a clear error instead of silently using origin transfer. No arbitrary third-party URL fetching.
- One protected `GET ?category=...&all=1` supplies all catalog image URLs in a single small metadata response; category previews stay 36/page. Photos download sequentially to reduce mobile memory, with a 12 MB maximum per image. Progress reports attempted requests, NOT confirmed disk writes.
- If R2 denies CORS, the batch stops at the first denied R2 request to protect quotas and battery. **Vercel transfer per photo is zero**. The data itself consumes Cloudflare/R2 CDN bandwidth and the user's mobile network, not Vercel Fast Origin Transfer.
- Existing reseller login behaviour still routes to dashboard unless `redirect=/download-images` is specifically set (allowlist avoids open redirects).

## REQUIRED Cloudflare R2 CORS setup before production

For a browser to retrieve image bytes and save files with original names, the Cloudflare R2 bucket that serves `images.primehubmall.com` must allow **GET** (and optionally HEAD) from BOTH exact live origins. Configure via Cloudflare dashboard → R2 → target bucket → Settings → CORS policy. Example policy format (dashboard uses AllowedOrigins/AllowedMethods/AllowedHeaders):

```json
[
  {
    "AllowedOrigins": ["https://primehubmall.com", "https://www.primehubmall.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": [],
    "ExposeHeaders": ["Content-Length", "Content-Type"],
    "MaxAgeSeconds": 86400
  }
]
```

**Do not enable PUT/POST, credentials, or all origins.** Inspect existing bucket policy and merge origins rather than replacing existing unrelated CORS rules. For already-cached objects on R2 custom domains, Cloudflare may need a targeted cache purge so CORS headers become visible. Test with an Origin request header and verify Access-Control-Allow-Origin returns the exact requested site origin. **No CORS policy was changed in this GitHub-only branch.** For 9 legacy ImgBB product covers, either ImgBB must permit CORS or migrate images to Cloudflare R2 before promising all photos work.

## QA before deployment

- Strict GitHub Action: TypeScript, 123-image category completeness, direct-only CDN/no-origin-proxy safeguards, wallet opt-in read regression, Next build.
- Verify category `Glass bangles`: one button sends every photo as an individually saved file and gallery/variant duplicates are not re-downloaded.
- Verify category `Metal bangles`: >100 files downloadable from ONE button, Chrome multiple-download permission can be granted, filenames remain unique, failed requests are counted.
- Verify login not authenticated, already signed in, blocked member, expired/revoked token.
- Verify actual mobile Chrome download manager, site permission for multiple automatic downloads, device memory and WhatsApp sharing of saved images. Android WebView download behavior requires physical-device verification.
- Check both homepage (HomeHeader) and category/shop (Header) layout at 360px, 393px, and 430px.
- Verify original image color/design is never regenerated or altered. No production wallet balance, order, or reseller account was mutated by this feature.
- Merge only after explicit owner approval; there is no Vercel preview while preview deploys are disabled.
