import glassBoxes from '@/scripts/glass-image-presentation-20261121.json';
import catalogBoxes from '@/scripts/catalog-image-presentation-20261121.json';
const boxes = { ...glassBoxes, ...catalogBoxes };

export type GlassContentBox = { sourceWidth: number; sourceHeight: number; left: number; top: number; width: number; height: number };

/** Only reviewed, content-addressed repair objects can use a duplicate-padding viewbox. */
export function getGlassContentBox(source: unknown): GlassContentBox | null {
  if (typeof source !== 'string') return null;
  try {
    const url = new URL(source);
    if (!['images.primehubmall.com', 'pub-157b90419bf04016bdea666e4cbce181.r2.dev'].includes(url.hostname) ||
        !['/products/glass-repair-20261121/', '/products/catalog-repair-20261121/'].some(prefix => url.pathname.startsWith(prefix))) return null;
    const key = url.pathname.split('/').pop() || '';
    const b = (boxes as Record<string, number[]>)[key];
    if (!b || b.length !== 6 || b.some(value => !Number.isFinite(value))) return null;
    const [sourceWidth, sourceHeight, left, top, width, height] = b;
    if (sourceWidth <= 0 || sourceHeight <= 0 || left < 0 || top < 0 || width <= 0 || height <= 0 ||
        left + width > sourceWidth || top + height > sourceHeight) return null;
    return { sourceWidth, sourceHeight, left, top, width, height };
  } catch { return null; }
}
