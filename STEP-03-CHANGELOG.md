# PrimeHub Deals — Step 03

## Weekly Deals — Sunday to Saturday

Added a Firestore-backed weekly deals system inside `settings/main.weeklyDeals`.

### Admin
- Seven dedicated day slots: Sunday through Saturday.
- Each day can be activated/deactivated.
- Day label and title.
- Image upload through existing ImgBB setup or image URL.
- Original price and special deal price.
- Start/end date-time.
- CTA text/link.
- Preview image.
- Saved with the existing Site Settings save flow.

### Homepage
- New premium horizontal card section appears after the main Daily Deal.
- Cards are ordered Sunday → Saturday.
- Shows day badge, discount percentage, original price, deal price, remaining time, and CTA.
- Section stays hidden if no weekly deals are active.

### Deliberate next improvement
Product selection is still a text `productId` field. A later step can connect this to the existing products collection with a real picker.
