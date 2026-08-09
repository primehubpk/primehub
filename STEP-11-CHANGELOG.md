# STEP 11 integration

A new `components/AdminOrdersDashboard.tsx` was added.

To use it inside the existing `/admin` Orders tab:
1. Import:
   `import AdminOrdersDashboard from '@/components/AdminOrdersDashboard';`
2. In the existing Orders tab JSX, render:
   `<AdminOrdersDashboard />`

The existing admin page was intentionally not replaced, because it is a live admin panel and blindly rewriting its large single-file structure could remove existing settings/product/category functionality.

The dashboard reads the existing `orders` collection and supports:
- search
- status filters
- pending / confirmed / shipped / delivered / cancelled
- order detail drawer
- customer details
- item list and totals
- status updates
- WhatsApp customer contact

IMPORTANT: Firestore security rules are still required before production.
