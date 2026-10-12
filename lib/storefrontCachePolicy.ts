import { createHash } from 'node:crypto';

// Admin and uploader writes invalidate tags immediately. This is a safety net
// for changes made outside those paths, not a delay on normal admin updates.
export const STOREFRONT_REVALIDATE_SECONDS = 21600;

export function publicProductCacheTag(productId: string) {
  // Bound the tag length even when a caller supplies a long or encoded ID.
  return `public-product:${createHash('sha256').update(productId.trim()).digest('hex')}`;
}
