# STEP 14 — Homepage Command Center

## Added
- `components/HomeControls.tsx`
  - Admin-editable announcement bar
  - Daily hero image URL
  - Hero title/subtitle/CTA
  - Hero link
  - Daily deal price
  - Old price
  - Deal image
  - Ends text
  - Rewards section toggle
- `components/DailyDealHero.tsx`
  - Live Firestore `settings/home` listener
  - Premium large homepage daily deal banner
- Homepage wiring attempts to render `DailyDealHero` at the top of `app/page.tsx`.

## Firestore
Uses:
`settings/home`

This is separate from the existing `settings/main` so the existing site settings are not overwritten.

## Admin integration
Import:
`import HomeControls from '@/components/HomeControls';`

Render `<HomeControls />` inside the authenticated admin area (preferably as a new "Homepage" tab).

Because the existing `/admin/page.tsx` is a large live file, it was not blindly rewritten.

## Important
The HomeControls writes `settings/home`. Your Firestore rules already protect the `settings` collection with the admin UID rule from Step 13.

## Daily update workflow
Admin can change the daily deal image/price from the panel. The storefront listens live, so a saved change appears without rebuilding the site.

## Existing systems preserved
Firebase init, ImgBB, products, categories, checkout, orders, rewards and security template are preserved.
