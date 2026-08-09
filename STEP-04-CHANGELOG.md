# PrimeHub Deals — Step 04

## Price Buckets — Shop by Budget

Added Admin-controlled price bucket filters backed by `settings/main.priceBuckets`.

### Admin
- Default buckets: Under 99, Under 300, Under 500, Under 1000.
- Change title, max price, accent, sort order, icon/image.
- Upload icon/image using the existing ImgBB setup.
- Turn each bucket ON/OFF.
- Existing Site Settings save flow persists the configuration.

### Homepage
- Premium "Shop by budget" cards appear after Weekly Deals.
- Customer taps a bucket to filter the ProductGrid.
- Product filter uses the current product `price` field and shows products priced at or below the selected amount.
- Clear button restores the full product list.
- Bucket order follows Admin `sortOrder`.

### Note
This first filter pass uses the existing `ProductGrid` product price field. Later, we can add advanced price-bucket analytics, URL/deep-link state, and more polished empty/filter states.
