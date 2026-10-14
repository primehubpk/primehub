import 'server-only';

import { unstable_cache } from 'next/cache';
import { getDualFeedCatalog } from '@/lib/dualReadServer';
import { getPublicCatalogSnapshot } from '@/lib/publicCatalogServer';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { productMatchesCategory, slugifyCategory } from '@/lib/categoryUtils';

export const IMAGE_PAGE_SIZE = 36;

export type GalleryImage = {
  id: string; productId: string; title: string; url: string; filename: string;
};
export type GalleryCategory = {
  id: string; title: string; slug: string; count: number; cover: string;
};
type GallerySnapshot = { categories: GalleryCategory[]; byCategory: Record<string, GalleryImage[]> };

export function downloadableImageUrl(value: unknown): string {
  let raw = '';
  if (typeof value === 'string') raw = value;
  else if (value && typeof value === 'object') {
    const item = value as { url?: unknown; imageUrl?: unknown };
    raw = typeof item.url === 'string' ? item.url : typeof item.imageUrl === 'string' ? item.imageUrl : '';
  }
  const url = normalizeImageUrl(raw);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return '';
    if (!['images.primehubmall.com', 'i.ibb.co', 'pub-157b90419bf04016bdea666e4cbce181.r2.dev'].includes(parsed.hostname)) return '';
    return parsed.toString();
  } catch { return ''; }
}

export function safeDownloadName(text: unknown, max = 64) {
  return String(text || 'image').normalize('NFKD').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'image';
}
function extensionFromUrl(url: string) {
  const name = new URL(url).pathname.toLowerCase();
  return name.endsWith('.png') ? '.png' : name.endsWith('.webp') ? '.webp' : name.endsWith('.gif') ? '.gif' : name.endsWith('.avif') ? '.avif' : '.jpg';
}
function imagesForProduct(product: any): GalleryImage[] {
  const title = String(product.title || product.name || 'PrimeHub product').trim();
  const id = String(product.id || '').trim();
  if (!id) return [];
  const values: unknown[] = [product.imageUrl, product.image, ...(Array.isArray(product.images) ? product.images : [])];
  for (const row of [...(Array.isArray(product.variantMatrix) ? product.variantMatrix : []), ...(Array.isArray(product.variants) ? product.variants : [])]) {
    if (!row || row.active === false || row.hidden === true) continue;
    values.push(row.imageUrl, row.image, ...(Array.isArray(row.images) ? row.images : []));
  }
  if (product.colorImages && typeof product.colorImages === 'object') values.push(...Object.values(product.colorImages));
  if (Array.isArray(product.variantColors)) {
    for (const color of product.variantColors) if (color && typeof color === 'object') values.push(color.imageUrl);
  }
  const seen = new Set<string>();
  const result: GalleryImage[] = [];
  for (const value of values) {
    const url = downloadableImageUrl(value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const ordinal = result.length + 1;
    result.push({
      id: `${id}:${ordinal}`, productId: id, title, url,
      filename: `${safeDownloadName(title)}-${safeDownloadName(id, 26)}-${String(ordinal).padStart(2, '0')}${extensionFromUrl(url)}`,
    });
  }
  return result;
}

export function assembleGallery(products: any[], categories: any[]): GallerySnapshot {
  const visible = products.filter(p => p && p.active !== false && p.published !== false);
  const categoryList = categories.filter(c => c && c.active !== false && String(c.title || c.name || '').trim())
    .sort((a,b) => Number(a.sortOrder ?? a.order ?? 999) - Number(b.sortOrder ?? b.order ?? 999) || String(a.title || '').localeCompare(String(b.title || '')));
  const byCategory: Record<string, GalleryImage[]> = {};
  const summaries: GalleryCategory[] = [];
  const productImages = visible.map(product => ({ product, images: imagesForProduct(product) }));
  for (const category of categoryList) {
    const title = String(category.title || category.name || '');
    const slug = slugifyCategory(title);
    // Preserve category name rather than old duplicated admin slug ('p', 'g').
    if (!slug || Object.prototype.hasOwnProperty.call(byCategory, slug)) continue;
    const images: GalleryImage[] = [];
    const seen = new Set<string>();
    for (const item of productImages) {
      if (!productMatchesCategory(title, item.product, categoryList)) continue;
      for (const picture of item.images) {
        if (seen.has(picture.url)) continue;
        seen.add(picture.url);
        images.push(picture);
      }
    }
    if (!images.length) continue;
    byCategory[slug] = images;
    summaries.push({ id: String(category.id || slug), title, slug, count: images.length,
      cover: downloadableImageUrl(category.imageUrl || category.iconUrl) || images[0].url });
  }
  return { categories: summaries, byCategory };
}

// Catalog is loaded once per update, not once per image or thumbnail.
async function loadGallery(): Promise<GallerySnapshot> {
  try {
    const source = await getDualFeedCatalog({ cache: 'no-store', timeoutMs: 8000 });
    if (source.source !== 'empty' && source.products.length) return assembleGallery(source.products, source.categories);
  } catch (error) { console.warn('Reseller image gallery full catalog fallback:', error); }
  const source = await getPublicCatalogSnapshot();
  return assembleGallery(source.products, source.categories);
}

export const getResellerImageGallery = unstable_cache(loadGallery, ['primehub-reseller-image-gallery-v1'], {
  revalidate: 21600, tags: ['public-catalog', 'reseller-image-gallery'],
});
