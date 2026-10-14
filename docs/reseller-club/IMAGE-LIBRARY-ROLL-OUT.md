# PrimeHub Reseller Image Library — branch implementation

Branch: `feature/reseller-wallet-admin-dupes-oct14`. DO NOT MERGE OR DEPLOY without owner approval.

## Shopper UX

- Homepage `My Orders → Images → Shop → Cart` (same icon also on standard/header routes).
- Clicking Images opens `/download-images`. If not signed in, it goes to the existing **/reseller/join?redirect=/download-images** page; no second Auth provider / password database / popup is added.
- Already-signed-in active resellers skip the login prompt.
- Firebase Auth token and active `reseller_profiles/{uid}` status are verified on every catalog/download request. Blocked/revoked sessions cannot access it.
- The page displays active category cards, search, category image thumbnails, 36 photos/page and Load more.
- Each photo is downloadable individually with its catalog-derived safe filename.
- Download All sequentially offers every part of a selected category as ZIP files, 40 images per part; individual ZIP part buttons are also offered to work around mobile multiple-download blocking.
- Images include cover, gallery and variant photos, deduplicated by URL, with no demo content.
- ZIP downloads save into the **browser's Downloads** destination, not directly to an Android Gallery album. Large ZIPs must be extracted on mobile. Native Android WebView DownloadManager behavior must be tested separately.

## Performance and safety

- Uses one cached full catalog snapshot (Supabase primary / Firebase fallback), invalidated by `public-catalog`; only authorized accounts can retrieve gallery metadata.
- Listing paginated, thumbnail image requests are directly against Cloudflare R2/ImgBB, not Vercel.
- Binary image downloads/ZIPs are **on-demand** via Vercel server, restricted to CDN hosts observed in the production catalog; no arbitrary third-party URL fetching.
- ZIPs streamed with STORE mode (photos already compressed), 40 items maximum per pack, 9MB maximum per individual image; failed CDN files listed in `DOWNLOAD-ISSUES.txt` rather than represented as if downloaded.
- Triggering ZIP downloads does use Vercel transfer and CPU; do not use this to preload full collections and monitor origin-transfer quota after an approved release.
- Existing reseller login behaviour still routes to dashboard unless `redirect=/download-images` is specifically set (allowlist avoids open redirects).

## QA before deployment

- Strict GitHub Action: TypeScript, ZIP stream/CDN integrity tests, Next build.
- Verify category `Glass bangles`: all product and variant images shown; duplicates are not repeated in ZIP.
- Verify category `Metal bangles`: multiple packs, each downloaded and extractable, including failures summary if needed.
- Verify login not authenticated, already signed in, blocked member, expired/revoked token.
- Verify actual mobile Chrome download manager, device memory, PDF/ZIP extractor, and WhatsApp sharing of saved images. Android WebView download behavior requires physical-device verification.
- Check both homepage (HomeHeader) and category/shop (Header) layout at 360px, 393px, and 430px.
- Verify original image color/design is never regenerated or altered. No production wallet balance, order, or reseller account was mutated by this feature.
- Merge only after explicit owner approval; there is no Vercel preview while preview deploys are disabled.
