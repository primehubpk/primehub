/** Compact customer-facing labels; the actual size identifier is never changed. */
const bangleDescriptions: Record<string, string> = {
  '2.2': 'Small inch (Bareek hand / 10–13 year baby girl)',
  '2.4': 'Ponay 2 / Apda 2 size',
  '2.6': 'Sawa 2 (Regular standard size)',
  '2.8': 'Large (Dhai size / Healthy hand)',
};
export function shortCardSize(size: string): string {
  const clean = String(size || '').trim();
  return /^\d+(?:\.\d+)?/.exec(clean)?.[0] || clean.split(/\s+-\s+/)[0] || clean;
}
export function cardSizeDescription(size: string, category = ''): string {
  const clean = String(size || '').trim();
  if (!clean) return '';
  if (/\s+-\s+/.test(clean)) return clean;
  const key = shortCardSize(clean);
  return /bangle|churi|choori|churri/i.test(category) && bangleDescriptions[key]
    ? key + ' — ' + bangleDescriptions[key]
    : clean;
}
export function uniqueCardSizes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((v): v is string => typeof v === 'string')
    .map(v => v.trim()).filter(v => {
      if (!v || seen.has(v.toLowerCase())) return false;
      seen.add(v.toLowerCase()); return true;
    });
}
