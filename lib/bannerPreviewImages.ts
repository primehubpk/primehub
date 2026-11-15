import { shuffleForVisit } from './shuffleProducts';

/** Public decorative photos only: unique, stable for a visit, new lead photo on return. */
export function selectBannerPreviews(images: readonly string[], seed: number, namespace: string, previousFirst = '', count = 2): string[] {
  const pool = [...new Set(images.filter(Boolean))];
  const ordered = shuffleForVisit(pool.map(src => ({ id: src, src })), seed, namespace);
  if (ordered.length > 1 && ordered[0].src === previousFirst) ordered.push(ordered.shift()!);
  return ordered.slice(0, Math.max(0, count)).map(item => item.src);
}
