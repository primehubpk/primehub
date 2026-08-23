export type CategoryRef = {
  id?: string;
  title?: string;
  name?: string;
  slug?: string;
  aliases?: string[];
};

export const CATEGORY_ALIASES: Record<string, string[]> = {
  'antique-bangles': ['bangles', 'antique-bangle', 'antique bangles'],
  bangles: ['antique-bangles', 'antique-bangle', 'antique bangles'],
};

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
    : slugifyCategory(category.slug || category.title || category.name || category.id || '');
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

export function expandCategoryTokens(selected: string, categories: CategoryRef[] = []): Set<string> {
  const tokens = new Set(categoryTokens(selected));
  for (const category of categories) {
    const docTokens = [
      ...categoryTokens(category.title || ''),
      ...categoryTokens(category.name || ''),
      ...categoryTokens(category.slug || ''),
      ...categoryTokens(category.id || ''),
      ...(category.aliases || []).flatMap((alias) => categoryTokens(alias)),
    ];
    if (docTokens.some((token) => tokens.has(token))) {
      docTokens.forEach((token) => tokens.add(token));
    }
  }
  return tokens;
}

export function productMatchesCategory(
  selected: string,
  product: { category?: string; categoryId?: string },
  categories: CategoryRef[] = [],
): boolean {
  if (!selected || selected === 'all') return true;
  const selectedTokens = expandCategoryTokens(selected, categories);
  const productTokens = [
    ...categoryTokens(String(product.category || '')),
    ...categoryTokens(String(product.categoryId || '')),
  ];
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
    return tokens.some((token) => selectedTokens.has(token));
  });
  return match?.title || match?.name || selected.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
