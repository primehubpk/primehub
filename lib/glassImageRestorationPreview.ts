import 'server-only';
import { createHash } from 'node:crypto';
import glassRepairs from '@/scripts/glass-image-repair-20261121.json';
import catalogRepairs from '@/scripts/catalog-image-repair-20261121.json';
const repairs = [...glassRepairs, ...catalogRepairs];
import { normalizeImageUrl } from '@/lib/imageUrl';

export const glassImagePreviewEnabled = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'production';
export const glassImagePreviewCacheKey = glassImagePreviewEnabled
  ? 'glass-sources-' + createHash('sha256').update(JSON.stringify(repairs)).digest('hex').slice(0, 16)
  : 'live-glass-catalog';

type Repair = { productId: string; oldUrl: string; newUrl: string; width: number; height: number };
const byId = new Map((repairs as Repair[]).map(row => [row.productId, row]));
/** Local/preview proposal only. Live records and later Admin uploads always win. */
export function applyGlassImageRestorationPreview<T extends { id?: unknown; [key: string]: any }>(product: T): T {
  if (!glassImagePreviewEnabled) return product;
  const row = byId.get(String(product.id));
  if (!row) return product;
  const old = normalizeImageUrl(row.oldUrl);
  if (normalizeImageUrl(String(product.imageUrl || product.image || '')) !== old) return product;
  function replace(value: any): any {
    if (typeof value === 'string') return normalizeImageUrl(value) === old ? row!.newUrl : value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  }
  return { ...replace(product), imageWidth: row.width, imageHeight: row.height };
}
