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

/** False bangle-hand sizes copied onto unrelated products must never be offered.
 * The source catalog remains untouched; this is a conservative display and
 * checkout safety check until the owner repairs the source variants in Admin.
 */
export interface SizeAuditProduct {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  category?: unknown;
  availableSizes?: unknown;
  variantMatrix?: unknown;
  variants?: unknown;
}

function sizeStrings(product: SizeAuditProduct): string[] {
  const rows = [...(Array.isArray(product.variantMatrix) ? product.variantMatrix : []),
    ...(Array.isArray(product.variants) ? product.variants : [])] as Array<Record<string, unknown>>;
  const fromRows = rows.map(row => String(row.size ?? row.variantSize ??
    (row.options && typeof row.options === 'object' ? (row.options as Record<string, unknown>).size : '') ?? '').trim());
  return uniqueCardSizes(fromRows.length ? fromRows : product.availableSizes);
}

function isBangleItem(product: SizeAuditProduct): boolean {
  const title = String(product.title || product.name || '');
  if (/\b(swing|jhoola|jhula|sock|bootie|shoe|garment|sweatshirt|jogger|blanket|winter vest|hooded suit)\b/i.test(title)) return false;
  return /bangl|churi|choori|chud[iy]|chura|chooda|churra|kangan|karay|kada\b/i.test(title + ' ' + String(product.category || ''));
}
function hasHandMeasurements(size: string): boolean {
  return /\b(normal hand|bareek hand|healthy hand|bhari hand|sawa 2|ponay 2|apda 2|dhai size)\b/i.test(size);
}
/** This is a DATA error, not a user-selectable variant: requires Admin correction. */
export function hasMismatchedHandSizes(product: SizeAuditProduct): boolean {
  const values = sizeStrings(product);
  return values.length > 0 && !isBangleItem(product) && values.some(hasHandMeasurements);
}
function isUnitOrPackDescription(size: string): boolean {
  return /^(one pair|girls bracelet\s*[-—]|mehndi (?:box|pack)\b|mix size box\b|3 packs?\s*[-—])/i.test(size.trim());
}
/** Return true sizes only; not bundles, fixed quantities, adjustable-fit claims or mistaken bangle labels. */
export function getCardSizeOptions(product: SizeAuditProduct): string[] {
  if (hasMismatchedHandSizes(product)) return [];
  return sizeStrings(product).filter(size => !isUnitOrPackDescription(size));
}
