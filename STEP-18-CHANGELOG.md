# STEP 18 — Performance, SEO, PWA & Play Store Readiness

## Scope
This step improves discoverability, installability and safe frontend delivery without changing the Firestore schema, Firebase project, ImgBB upload flow, products, categories, orders, cart or admin features.

## Added
- SEO metadata, robots directives and JSON-LD website/search schema in `app/layout.tsx`.
- Optional `NEXT_PUBLIC_SITE_URL` support for canonical/absolute SEO URLs.
- `app/robots.ts` with admin/checkout/orders disallowed from crawlers.
- `app/sitemap.ts` for public routes when `NEXT_PUBLIC_SITE_URL` is configured.
- `app/manifest.ts` for PWA/app metadata.
- 192px and 512px app icons under `public/icons/`.
- Safe service-worker registration foundation via `components/PWARegister.tsx` and `public/sw.js`.
- Static icon cache headers and safe compression setting in `next.config.js`.

## Safety
- The service worker does not intercept/fetch/cache requests yet, so it cannot interfere with Firebase, ImgBB, checkout, WhatsApp or YouTube.
- No Firestore collection/document migration was performed.
- No Firebase configuration was replaced.
- No ImgBB API setup was changed.
- No product/category/order/cart/admin behavior was intentionally changed.

## Production configuration
Set `NEXT_PUBLIC_SITE_URL` to the real public website origin in the deployment environment, for example: `https://your-real-domain.example`

Do not replace it with a guessed domain. The sitemap stays empty until the real URL is configured.

## Verification
A dependency-backed production build still needs to be run in a normal npm environment. Do not call Step 18 build verification PASS until `npm install` and `npm run build` actually complete successfully.
