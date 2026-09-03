type SearchableProduct = Record<string, any> & { id?: string; title?: string; name?: string; category?: string; categoryId?: string; description?: string; tags?: unknown };

const ALIASES: Record<string, string[]> = {
  bangle: ['bangles', 'churi', 'churiyan', 'bracelet'],
  bangles: ['bangle', 'churi', 'churiyan', 'bracelet'],
  kara: ['kada', 'karray', 'karay', 'bracelet'],
  karray: ['kara', 'kada', 'karay', 'bracelet'],
  jewellery: ['jewelry', 'jewelery'],
  jewelry: ['jewellery', 'jewelery'],
  gold: ['golden'],
  golden: ['gold'],
  silver: ['silvery'],
  red: ['maroon', 'mehroon'],
  maroon: ['mehroon', 'red'],
  mehroon: ['maroon', 'red'],
};

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return previous[b.length];
}

function tokenMatches(queryToken: string, candidateToken: string): boolean {
  if (!queryToken || !candidateToken) return false;
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return true;
  const aliases = ALIASES[queryToken] || [];
  if (aliases.some((alias) => candidateToken === alias || candidateToken.includes(alias))) return true;
  if (queryToken.length < 4 || candidateToken.length < 4) return false;
  const maxDistance = queryToken.length >= 8 ? 2 : 1;
  return editDistance(queryToken, candidateToken) <= maxDistance;
}

function textValues(product: SearchableProduct): string[] {
  const tags = Array.isArray(product.tags) ? product.tags : typeof product.tags === 'string' ? product.tags.split(',') : [];
  const keywords = Array.isArray(product.keywords) ? product.keywords : typeof product.keywords === 'string' ? product.keywords.split(',') : [];
  return [
    product.title,
    product.name,
    product.category,
    product.categoryId,
    product.description,
    product.shortDescription,
    product.color,
    product.material,
    ...tags,
    ...keywords,
  ].map(normalizeSearchText).filter(Boolean);
}

export function productSearchScore(product: SearchableProduct, rawQuery: string): number {
  const query = normalizeSearchText(rawQuery);
  if (!query) return 1;
  const values = textValues(product);
  const title = normalizeSearchText(product.title || product.name);
  const haystack = values.join(' ');
  if (!haystack) return 0;

  let score = 0;
  if (title === query) score += 120;
  if (title.startsWith(query)) score += 90;
  if (title.includes(query)) score += 70;
  if (haystack.includes(query)) score += 45;

  const queryTokens = query.split(' ').filter(Boolean);
  const candidateTokens = haystack.split(' ').filter(Boolean);
  let matched = 0;
  for (const token of queryTokens) {
    if (candidateTokens.some((candidate) => tokenMatches(token, candidate))) {
      matched += 1;
      score += 18;
    }
  }
  if (queryTokens.length && matched === queryTokens.length) score += 35;
  return score;
}

export function smartSearchProducts<T extends SearchableProduct>(products: T[], query: string): T[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return products;
  return products
    .map((product, index) => ({ product, index, score: productSearchScore(product, normalized) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.product);
}
