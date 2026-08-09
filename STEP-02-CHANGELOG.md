# PrimeHub Deals — Step 02

## Daily Deal System foundation

- Added a dedicated `DailyDeal` type.
- Added a Firestore-backed `settings/main.dailyDeal` object.
- Admin can enable/disable the daily deal.
- Admin can set title, image (ImgBB upload or URL), original price, deal price, start/end date-time, CTA text and link.
- Homepage hero now renders the daily deal and a live countdown.
- Discount percentage is calculated automatically.
- Existing legacy hero settings remain for backwards compatibility.

## Deliberate next improvement
The product ID is currently a text field. In the next pass we can replace it with a real product picker from the existing `products` collection, so Admin can select a product instead of typing an ID.
