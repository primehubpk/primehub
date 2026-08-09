# PrimeHub Deals — Step 10

## Checkout + Firestore Orders

### Added
- `/checkout` customer checkout page.
- Customer name, phone/WhatsApp, email, city, address and notes.
- Full cart review before order.
- Website order placement into existing Firestore `orders` collection.
- Order status starts as `pending`.
- Each order stores customer details, item snapshots, quantities, prices, subtotal/total and timestamps.
- Cart clears only after Firestore successfully returns an order ID.
- Success screen with order ID.
- WhatsApp fallback from checkout.
- Cart Drawer now links to real `/checkout`.

### Important
This implements the storefront order-write flow, but Firebase security rules are STILL required before production.
The admin Orders screen can now read the orders created by this checkout if its existing query reads the `orders` collection.

### Existing configuration preserved
- Firebase project/init unchanged.
- ImgBB setup unchanged.
- Products/categories unchanged.
- Existing Zustand cart retained.
