# PrimeHub Reseller Image Library — branch implementation

Branch: `feature/reseller-wallet-admin-dupes-oct14`. DO NOT MERGE OR DEPLOY without owner approval.

## Shopper UX

- Homepage `My Orders → Images → Shop → Cart` (same icon also on standard/header routes).
- Clicking Images opens `/download-images`. If not signed in, it goes to the existing **/reseller/join?redirect=/download-images** page; no second Auth provider / password database / popup is added.
- Already-signed-in active resellers skip the login prompt.
- Firebase Auth token and active `reseller_profiles/{uid}` status are verified on every catalog/download request. Blocked/revoked sessions cannot access it.
- The page displays active category cards, search, category image thumbnails, 36 photos/page and Load more.
- Each photo is downloadable individually with its catalog-derived safe filename.
- **One tap on a category tile** selects that category and starts downloading every original photo as a separate image file; the Download All button can be used to retry. No ZIP archives, extraction step or fixed-size packs. The browser may ask to allow automatic multiple downloads; websites cannot bypass that Chrome protection.
- Images include cover, gallery and variant photos, deduplicated by URL, with no demo content.
- Each original JPG/PNG/WebP file is offered individually to the **Chrome Downloads** destination (not guaranteed to appear instantly inside Android Gallery). Chrome may block additional automatic downloads until the user approves its site permission. Browsers do not disclose whether every requested file actually landed on storage; UI says requested/sent, never falsely confirms disk writes. Native Android WebView DownloadManager behavior must be tested separately.

## Performance and safety

- Uses one cached full catalog snapshot (Supabase primary / Firebase fallback), invalidated by `public-catalog`; only authorized accounts can retrieve gallery metadata.
- Listing paginated, thumbnail image requests are directly against Cloudflare R2/ImgBB, not Vercel.
- Image downloads are **on-demand** and attempted directly from approved Cloudflare R2 / ImgBB CDNs if cross-origin browser access permits; otherwise a Firebase-authenticated Vercel image-only proxy handles the file. No arbitrary third-party URL fetching.
- Individual images are downloaded sequentially to reduce memory usage, with a 9 MB maximum per file. Progress reports attempted image requests and errors rather than promising browser approval.
- On Chrome devices where the CDN denies CORS, every downloaded photo uses Vercel transfer and CPU. Monitor origin-transfer quota after an approved release, and do not pre-download collections without a user gesture.
- Existing reseller login behaviour still routes to dashboard unless `redirect=/download-images` is specifically set (allowlist avoids open redirects).

## QA before deployment

- Strict GitHub Action: TypeScript, 123-image category completeness, CDN access/validation tests, Next build.
- Verify category `Glass bangles`: one button sends every photo as an individually saved file and gallery/variant duplicates are not re-downloaded.
- Verify category `Metal bangles`: >100 files downloadable from ONE button, Chrome multiple-download permission can be granted, filenames remain unique, failed requests are counted.
- Verify login not authenticated, already signed in, blocked member, expired/revoked token.
- Verify actual mobile Chrome download manager, site permission for multiple automatic downloads, device memory and WhatsApp sharing of saved images. Android WebView download behavior requires physical-device verification.
- Check both homepage (HomeHeader) and category/shop (Header) layout at 360px, 393px, and 430px.
- Verify original image color/design is never regenerated or altered. No production wallet balance, order, or reseller account was mutated by this feature.
- Merge only after explicit owner approval; there is no Vercel preview while preview deploys are disabled.
