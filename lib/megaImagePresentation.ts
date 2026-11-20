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

export const megaImageTrimStyle = { objectFit: 'cover' as const, transform: 'scale(1.195)', padding: 0 };
