# PrimeHub Deals — Step 01

Implemented the first homepage foundation without replacing the existing Firebase/ImgBB architecture.

## Changes
1. Daily Deal hero image is now controlled from Firestore `settings/main`.
2. Admin Site Settings can upload the hero image through the existing ImgBB setup.
3. Hero image URL fallback remains available.
4. Admin can set Hero CTA text and link.
5. Existing Firebase, Firestore, products, categories, orders, cart, and other components were preserved.

## Next
- Build the Admin-controlled Daily Deal data model (product, original price, deal price, exact expiry).
- Build Sunday–Saturday weekly deal manager.
- Build Admin-controlled price buckets.
- Then redesign the visual homepage around those live settings.
