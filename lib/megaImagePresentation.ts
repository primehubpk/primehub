/** Only the reviewed legacy files have an 8% baked blurred border.
 * A newer Admin photo, including one for the same product, stays untouched.
 */
const paddedFiles: Record<string, string> = {
  olyH0uP7w0c1OHqUCZvf: 'IMG-20260506-WA0202-1585f6856430.webp',
  snuIjJfa6dLY7VS8jc7j: '1768359603697-6dda7d0e1814.webp',
  fdjFxM4miXaFL2vuTNaB: '1768359603645-ce9d89e3dbee.webp',
  Drk9zpU2DWWFfXWcKYrY: 'IMG_20260102_101138-dd1397a42250.webp',
};

export function megaImageNeedsTrim(productId: unknown, image: string): boolean {
  const file = paddedFiles[String(productId)];
  if (!file) return false;
  try { return new URL(image).pathname === `/products/${file}`; } catch { return false; }
}

/** The reviewed 800x600 full gift-box photo looks letterboxed in a 4:5 recommendation tile.
 * Only its original R2 file gets the wide-photo treatment; later Admin replacements are exempt.
 */
export function megaImageNeedsWideBackdrop(productId: unknown, image: string): boolean {
  if (String(productId) !== '1qABfsZcsw66eDYTmeMJ') return false;
  try {
    return new URL(image).pathname === '/products/1795103525267-file_00000000cd20820bbdfb543ae9eaf6c9.webp';
  } catch {
    return false;
  }
}

// Keep the legacy helper shape for existing callers, while preserving every source edge.
export const megaImageTrimStyle = { objectFit: 'contain' as const, transform: 'none', padding: 0 };
