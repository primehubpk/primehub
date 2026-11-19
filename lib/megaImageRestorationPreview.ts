import 'server-only';
import { createHash } from 'node:crypto';
import repairs from '@/scripts/mega-image-restoration-20261119.json';
import { normalizeImageUrl } from '@/lib/imageUrl';

export const megaImagePreviewCacheKey = process.env.VERCEL_ENV === 'preview'
  ? 'mega-originals-' + createHash('sha256').update(JSON.stringify(repairs)).digest('hex').slice(0, 16)
  : 'live-catalog';

type Repair = { productId: string; oldUrl: string; newUrl: string; width: number; height: number };
/** Preview a reviewed one-time data restoration without editing the live catalog. */
export function applyMegaImageRestorationPreview<T extends { id?: unknown; [key: string]: any }>(product: T): T {
  if (process.env.VERCEL_ENV !== 'preview') return product;
  const repair = (repairs as Repair[]).find(item => item.productId === String(product.id));
  if (!repair) return product;
  const old = normalizeImageUrl(repair.oldUrl);
  // A later Admin upload always wins over this historical migration proposal.
  if (normalizeImageUrl(String(product.imageUrl || product.image || '')) !== old) return product;
  function replace(value: any): any {
    if (typeof value === 'string') return normalizeImageUrl(value) === old ? repair!.newUrl : value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  }
  return { ...replace(product), imageWidth: repair.width, imageHeight: repair.height };
}
