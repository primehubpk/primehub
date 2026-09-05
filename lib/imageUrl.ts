const LEGACY_R2_BASE = 'https://pub-157b90419bf04016bdea666e4cbce181.r2.dev';
const CUSTOM_R2_BASE = 'https://images.primehubmall.com';

export function normalizeImageUrl(value?: string | null) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url === LEGACY_R2_BASE) return CUSTOM_R2_BASE;
  if (url.startsWith(`${LEGACY_R2_BASE}/`)) {
    return `${CUSTOM_R2_BASE}${url.slice(LEGACY_R2_BASE.length)}`;
  }
  return url;
}
