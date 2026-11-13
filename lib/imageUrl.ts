const LEGACY_R2_BASE = 'https://pub-157b90419bf04016bdea666e4cbce181.r2.dev';
const CUSTOM_R2_BASE = 'https://images.primehubmall.com';

export function normalizeImageUrl(value?: string | null) {
  const url = String(value || '').trim();
  if (!url) return '';
  // Both hosts serve this owned bucket. Prefer its verified HTTPS public mirror
  // while the branded host has a TLS transport failure; never proxy via Vercel.
  if (url === CUSTOM_R2_BASE) return LEGACY_R2_BASE;
  if (url.startsWith(`${CUSTOM_R2_BASE}/`)) {
    return `${LEGACY_R2_BASE}${url.slice(CUSTOM_R2_BASE.length)}`;
  }
  return url;
}

export function isDirectStorefrontImage(value?: string | null) {
  const url = String(value || '').trim();
  return (
    url.startsWith(`${CUSTOM_R2_BASE}/`) ||
    url.startsWith(`${LEGACY_R2_BASE}/`) ||
    url.startsWith('https://i.ibb.co/')
  );
}
