export type CategoryRef = {
  id?: string;
  title?: string;
  name?: string;
  slug?: string;
  aliases?: string[];
};

export const CATEGORY_ALIASES: Record<string, string[]> = {
  'antique-bangles': ['bangles', 'bangle', 'antique-bangle', 'antique bangles'],
  bangles: ['antique-bangles', 'bangle', 'antique-bangle', 'antique bangles'],
  bangle: ['antique-bangles', 'bangles', 'antique-bangle', 'antique bangles'],
  'kids-metal-bangles': ['kids-bangles', 'kids-metal-bangle', 'kids-bangle', 'kids metal bangles', 'kids bangles'],
  'kids-bangles': ['kids-metal-bangles', 'kids-metal-bangle', 'kids-bangle', 'kids metal bangles', 'kids bangles'],
  'kids-metal-deals': ['kids-deal-box', 'kids-deals', 'kids-deal', 'kidsdealbox', 'kids metal deals', 'kids deal box'],
  'kids-deal-box': ['kids-metal-deals', 'kids-deals', 'kids-deal', 'kidsdealbox', 'kids metal deals', 'kids deal box'],
};

/** Families that must never share products, even if aliases or titles overlap. */
const EXCLUSIVE_CATEGORY_FAMILIES: string[][] = [
  ['kids-metal-bangles', 'kids-bangles', 'kids-metal-bangle', 'kids-bangle'],
  ['kids-metal-deals', 'kids-metal-deal', 'kids-deal-box', 'kids-deals', 'kids-deal', 'kidsdealbox'],
];

export function slugifyCategory(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function categoryHref(category: CategoryRef | string): string {
  const slug = typeof category === 'string'
    ? slugifyCategory(category)
    : slugifyCategory(category.title || category.name || category.slug || category.id || '');
  return slug ? `/category/${slug}` : '/shop';
}

function addToken(target: Set<string>, value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return;
  target.add(raw);
  target.add(raw.toLowerCase());
  const slug = slugifyCategory(raw);
  if (slug) target.add(slug);
}

export function categoryTokens(value: string, extras: string[] = []): string[] {
  const tokens = new Set<string>();
  addToken(tokens, value);
  extras.forEach((item) => addToken(tokens, item));
  const slug = slugifyCategory(value);
  (CATEGORY_ALIASES[slug] || []).forEach((alias) => addToken(tokens, alias));
  return Array.from(tokens);
}

function exclusiveFamilyIndex(values: Iterable<string>): number | null {
  const slugs = new Set<string>();
  for (const value of values) {
    const slug = slugifyCategory(value);
    if (slug) slugs.add(slug);
  }
  const hits: number[] = [];
  EXCLUSIVE_CATEGORY_FAMILIES.forEach((family, index) => {
    if (family.some((alias) => slugs.has(alias))) hits.push(index);
  });
  return hits.length === 1 ? hits[0] : null;
}

function categoryDocTokens(category: CategoryRef): string[] {
  return [
    ...categoryTokens(category.title || ''),
    ...categoryTokens(category.name || ''),
    ...categoryTokens(category.slug || ''),
    ...categoryTokens(category.id || ''),
    ...(category.aliases || []).flatMap((alias) => categoryTokens(alias)),
  ];
}

export function expandCategoryTokens(selected: string, categories: CategoryRef[] = []): Set<string> {
  const tokens = new Set(categoryTokens(selected));
  const selectedFamily = exclusiveFamilyIndex(tokens);
  for (const category of categories) {
    const docTokens = categoryDocTokens(category);
    const docFamily = exclusiveFamilyIndex(docTokens);
    if (selectedFamily != null && docFamily != null && selectedFamily !== docFamily) continue;
    if (!docTokens.some((token) => tokens.has(token))) continue;
    docTokens.forEach((token) => {
      const tokenFamily = exclusiveFamilyIndex([token]);
      if (selectedFamily != null && tokenFamily != null && tokenFamily !== selectedFamily) return;
      tokens.add(token);
    });
  }
  return tokens;
}

export function productMatchesCategory(
  selected: string,
  product: { category?: string; categoryId?: string },
  categories: CategoryRef[] = [],
): boolean {
  if (!selected || selected === 'all') return true;
  const productTokens = [
    ...categoryTokens(String(product.category || '')),
    ...categoryTokens(String(product.categoryId || '')),
  ];
  const selectedFamily = exclusiveFamilyIndex(categoryTokens(selected));
  const productFamily = exclusiveFamilyIndex(productTokens);
  if (selectedFamily != null && productFamily != null && selectedFamily !== productFamily) {
    return false;
  }
  if (selectedFamily != null && productFamily === selectedFamily) {
    return true;
  }
  const selectedTokens = expandCategoryTokens(selected, categories);
  return productTokens.some((token) => selectedTokens.has(token));
}

export function categoryLabel(selected: string, categories: CategoryRef[] = []): string {
  if (!selected || selected === 'all') return '';
  const selectedTokens = expandCategoryTokens(selected, categories);
  const match = categories.find((category) => {
    const tokens = [
      ...categoryTokens(category.title || ''),
      ...categoryTokens(category.name || ''),
      ...categoryTokens(category.slug || ''),
      ...categoryTokens(category.id || ''),
    ];
    const categoryFamily = exclusiveFamilyIndex(tokens);
    const selectedFamily = exclusiveFamilyIndex(selectedTokens);
    if (selectedFamily != null && categoryFamily != null && selectedFamily !== categoryFamily) {
      return false;
    }
    return tokens.some((token) => selectedTokens.has(token));
  });
  return match?.title || match?.name || selected.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
