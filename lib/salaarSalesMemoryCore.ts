export type SalaarMemoryFilters = {
  minPrice?: number;
  maxPrice?: number;
  targetPrice?: number;
  category?: string;
  subcategory?: string;
  color?: string;
  material?: string;
  quantity?: number;
  priceBucketId?: string;
  priceBucketLabel?: string;
  wholesaleOnly?: boolean;
  inStockOnly?: boolean;
};

export type SalaarCartMemoryItem = {
  productId: string;
  name?: string;
  quantity?: number;
};

export type SalaarSalesMemory = {
  version: 1;
  currentQuery: string;
  filters: SalaarMemoryFilters;
  sortBy: string;
  lastShownProductIds: string[];
  selectedProductId: string | null;
  comparisonProductIds: string[];
  visualSearchQuery: string;
  cart: SalaarCartMemoryItem[];
  updatedAt: string;
};

type MemoryIntent = {
  wantsProducts: boolean;
  filters: SalaarMemoryFilters;
  followUp: {
    more: boolean;
    cheaper: boolean;
    pricier: boolean;
    compare: boolean;
    referencedPosition?: number;
  };
  sortBy: string;
  terms: string[];
};

export type SalesMemoryResolution<T extends MemoryIntent> = {
  intent: T;
  selectedProductId: string | null;
  comparisonProductIds: string[];
  referenceOnly: boolean;
  memoryUsed: boolean;
};

const EMPTY_MEMORY: SalaarSalesMemory = {
  version: 1,
  currentQuery: '',
  filters: {},
  sortBy: 'relevance',
  lastShownProductIds: [],
  selectedProductId: null,
  comparisonProductIds: [],
  visualSearchQuery: '',
  cart: [],
  updatedAt: '',
};

function cleanText(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanId(value: unknown): string {
  return cleanText(value, 140).replace(/[^a-z0-9._:-]/gi, '');
}

function finitePositive(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
}

function cleanFilterString(value: unknown): string | undefined {
  const text = cleanText(value, 100);
  return text || undefined;
}

function sanitizeFilters(value: unknown): SalaarMemoryFilters {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    ...(finitePositive(source.minPrice) != null ? { minPrice: finitePositive(source.minPrice) } : {}),
    ...(finitePositive(source.maxPrice) != null ? { maxPrice: finitePositive(source.maxPrice) } : {}),
    ...(finitePositive(source.targetPrice) != null ? { targetPrice: finitePositive(source.targetPrice) } : {}),
    ...(cleanFilterString(source.category) ? { category: cleanFilterString(source.category) } : {}),
    ...(cleanFilterString(source.subcategory) ? { subcategory: cleanFilterString(source.subcategory) } : {}),
    ...(cleanFilterString(source.color) ? { color: cleanFilterString(source.color) } : {}),
    ...(cleanFilterString(source.material) ? { material: cleanFilterString(source.material) } : {}),
    ...(finitePositive(source.quantity) != null ? { quantity: finitePositive(source.quantity) } : {}),
    ...(cleanFilterString(source.priceBucketId) ? { priceBucketId: cleanFilterString(source.priceBucketId) } : {}),
    ...(cleanFilterString(source.priceBucketLabel) ? { priceBucketLabel: cleanFilterString(source.priceBucketLabel) } : {}),
    ...(source.wholesaleOnly === true ? { wholesaleOnly: true } : {}),
    ...(source.inStockOnly === true ? { inStockOnly: true } : {}),
  };
}

function sanitizeCart(value: unknown): SalaarCartMemoryItem[] {
  if (!Array.isArray(value)) return [];
  const result: SalaarCartMemoryItem[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Record<string, unknown>;
    const productId = cleanId(source.productId || source.id);
    if (!productId || seen.has(productId)) continue;
    seen.add(productId);
    const name = cleanText(source.name || source.title, 100);
    const quantity = finitePositive(source.quantity || source.qty);
    result.push({ productId, ...(name ? { name } : {}), ...(quantity ? { quantity } : {}) });
  }
  return result;
}

function sanitizeIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const id = cleanId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= max) break;
  }
  return result;
}

export function emptySalaarSalesMemory(): SalaarSalesMemory {
  return { ...EMPTY_MEMORY, filters: {}, lastShownProductIds: [], comparisonProductIds: [], cart: [] };
}

export function sanitizeSalaarSalesMemory(value: unknown): SalaarSalesMemory {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    version: 1,
    currentQuery: cleanText(source.currentQuery, 600),
    filters: sanitizeFilters(source.filters),
    sortBy: cleanText(source.sortBy, 30) || 'relevance',
    lastShownProductIds: sanitizeIds(source.lastShownProductIds, 30),
    selectedProductId: cleanId(source.selectedProductId) || null,
    comparisonProductIds: sanitizeIds(source.comparisonProductIds, 4),
    visualSearchQuery: cleanText(source.visualSearchQuery, 220),
    cart: sanitizeCart(source.cart),
    updatedAt: cleanText(source.updatedAt, 40),
  };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function referencedPositions(message: string): number[] {
  const value = normalize(message);
  const found: number[] = [];
  const add = (position: number) => {
    if (position >= 1 && position <= 30 && !found.includes(position)) found.push(position);
  };

  for (const match of value.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\b/g)) add(Number(match[1]));
  for (const match of value.matchAll(/\b(\d{1,2})\s*(?:wala|wali|product|item|one)\b/g)) add(Number(match[1]));

  const words: Array<[RegExp, number]> = [
    [/\b(?:first|pehla|pehli)\b/i, 1],
    [/\b(?:second|dusra|doosra|dusri|doosri)\b/i, 2],
    [/\b(?:third|teesra|tisra|teesri|tisri)\b/i, 3],
    [/\b(?:fourth|chautha|chotha)\b/i, 4],
    [/\b(?:fifth|panchwa|panchvi)\b/i, 5],
  ];
  for (const [regex, position] of words) if (regex.test(value)) add(position);
  return found.slice(0, 4);
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
    if (item && typeof item === 'object') {
      const source = item as Record<string, unknown>;
      const candidate = source.name || source.label || source.value || source.color || source.material;
      return typeof candidate === 'string' && candidate.trim() ? [candidate.trim()] : [];
    }
    return [];
  });
}

function productById(products: any[], id: string | null | undefined): any | undefined {
  if (!id) return undefined;
  return products.find((product) => String(product?.id || '') === id);
}

function productDerivedFilters(product: any): SalaarMemoryFilters {
  if (!product) return {};
  const category = cleanFilterString(product?.category);
  const subcategory = cleanFilterString(product?.subcategory);
  const color = stringValues(product?.color).concat(stringValues(product?.colors), stringValues(product?.variantColors))[0];
  const material = stringValues(product?.material).concat(stringValues(product?.materials))[0];
  return {
    ...(category ? { category } : {}),
    ...(subcategory ? { subcategory } : {}),
    ...(color ? { color } : {}),
    ...(material ? { material } : {}),
  };
}

function hasExplicitSearchFilter(filters: SalaarMemoryFilters): boolean {
  return Boolean(
    filters.category || filters.subcategory || filters.color || filters.material || filters.priceBucketId
    || filters.wholesaleOnly || filters.inStockOnly || filters.minPrice != null || filters.maxPrice != null
    || filters.targetPrice != null,
  );
}

function followUpCue(message: string, intent: MemoryIntent): boolean {
  const value = normalize(message);
  if (intent.followUp.more || intent.followUp.cheaper || intent.followUp.pricier || intent.followUp.referencedPosition != null) return true;
  if (/\b(?:isko|is ko|iss ko|iska|iski|iske|is ka|is ki|is ke|iss ka|iss ki|iss ke|isi|same|usko|uss ko|uska|uski|uske|wala|wali|jaisa|jaisi|similar|aur isi|same category|same design)\b/i.test(value)) return true;
  if ((intent.filters.color || intent.filters.material) && !intent.filters.category && value.split(' ').length <= 8) return true;
  return false;
}

export function resolveSalesTurnWithMemory<T extends MemoryIntent>(
  message: string,
  intent: T,
  memoryValue: unknown,
  products: any[],
): SalesMemoryResolution<T> {
  const memory = sanitizeSalaarSalesMemory(memoryValue);
  const next = {
    ...intent,
    filters: { ...intent.filters },
    followUp: { ...intent.followUp },
    terms: [...intent.terms],
  } as T;
  const positions = referencedPositions(message);
  if (!positions.length && next.followUp.referencedPosition != null) positions.push(next.followUp.referencedPosition);

  const referencedIds = positions
    .map((position) => memory.lastShownProductIds[position - 1])
    .filter((id): id is string => Boolean(id));
  const selectedProductId = referencedIds[0] || memory.selectedProductId || null;
  const selectedProduct = productById(products, selectedProductId);
  const derived = productDerivedFilters(selectedProduct);
  const cue = followUpCue(message, next);
  let memoryUsed = false;

  if (cue && memory.currentQuery) {
    const inherited = memory.filters;
    for (const key of ['minPrice', 'maxPrice', 'targetPrice', 'category', 'subcategory', 'color', 'material', 'priceBucketId', 'priceBucketLabel', 'wholesaleOnly', 'inStockOnly'] as const) {
      if (next.filters[key] == null && inherited[key] != null) {
        (next.filters as any)[key] = inherited[key];
        memoryUsed = true;
      }
    }
  }

  if (cue && selectedProduct) {
    for (const key of ['category', 'subcategory', 'material'] as const) {
      if (next.filters[key] == null && derived[key]) {
        next.filters[key] = derived[key];
        memoryUsed = true;
      }
    }
    if (/\b(?:same|isi|jaisa|jaisi|similar|same design)\b/i.test(normalize(message)) && next.filters.color == null && derived.color) {
      next.filters.color = derived.color;
      memoryUsed = true;
    }
  }

  if (/\b(?:same|isi|jaisa|jaisi|similar).*(?:aur|more|dikha|show)|(?:aur|more).*(?:same|isi|jaisa|jaisi|similar)\b/i.test(normalize(message))) {
    next.followUp.more = true;
    next.wantsProducts = true;
    memoryUsed = true;
  }

  if (positions.length) memoryUsed = true;
  const comparisonProductIds = next.followUp.compare ? referencedIds.slice(0, 4) : [];
  const explicit = hasExplicitSearchFilter(intent.filters);
  const referenceOnly = Boolean(
    referencedIds.length === 1
    && !next.followUp.compare
    && !next.followUp.more
    && !next.followUp.cheaper
    && !next.followUp.pricier
    && !explicit
    && !/\b(?:dikha|show|similar|jaisa|jaisi|same|color|rang|mein|mai|me)\b/i.test(normalize(message)),
  );

  return {
    intent: next,
    selectedProductId: referencedIds[0] || (cue ? selectedProductId : null),
    comparisonProductIds,
    referenceOnly,
    memoryUsed,
  };
}

export function updateSalaarSalesMemory(input: {
  previous: unknown;
  message: string;
  resolvedQuery: string;
  intent: MemoryIntent;
  shownProductIds: string[];
  selectedProductId?: string | null;
  comparisonProductIds?: string[];
  visualSearchQuery?: string | null;
  cart?: unknown;
  referenceOnly?: boolean;
}): SalaarSalesMemory {
  const previous = sanitizeSalaarSalesMemory(input.previous);
  const shown = sanitizeIds(input.shownProductIds, 30);
  const shouldReplaceSearch = input.intent.wantsProducts && !input.referenceOnly && Boolean(cleanText(input.resolvedQuery, 600));
  const filters = shouldReplaceSearch
    ? sanitizeFilters(input.intent.filters)
    : Object.keys(previous.filters).length ? previous.filters : sanitizeFilters(input.intent.filters);
  const cart = Array.isArray(input.cart) ? sanitizeCart(input.cart) : previous.cart;

  return {
    version: 1,
    currentQuery: shouldReplaceSearch ? cleanText(input.resolvedQuery, 600) : previous.currentQuery,
    filters,
    sortBy: shouldReplaceSearch ? cleanText(input.intent.sortBy, 30) || 'relevance' : previous.sortBy,
    lastShownProductIds: shown.length ? shown : previous.lastShownProductIds,
    selectedProductId: cleanId(input.selectedProductId) || previous.selectedProductId,
    comparisonProductIds: sanitizeIds(input.comparisonProductIds, 4),
    visualSearchQuery: cleanText(input.visualSearchQuery, 220) || previous.visualSearchQuery,
    cart,
    updatedAt: new Date().toISOString(),
  };
}

export function salesMemoryPromptContext(memoryValue: unknown, products: any[]): string {
  const memory = sanitizeSalaarSalesMemory(memoryValue);
  const selected = productById(products, memory.selectedProductId);
  const comparisons = memory.comparisonProductIds.map((id) => productById(products, id)).filter(Boolean);
  const cart = memory.cart.slice(0, 8).map((item) => `${item.name || item.productId}${item.quantity ? ` x${item.quantity}` : ''}`);
  const filterText = Object.entries(memory.filters)
    .filter(([, value]) => value != null && value !== false && value !== '')
    .slice(0, 10)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
  const lines = [
    memory.currentQuery ? `Current search: ${memory.currentQuery}` : '',
    filterText ? `Remembered filters: ${filterText}` : '',
    selected ? `Selected product: ${cleanText(selected?.title || selected?.name || selected?.productName, 100)} | id ${memory.selectedProductId}` : '',
    comparisons.length ? `Comparison products: ${comparisons.map((product) => `${cleanText(product?.title || product?.name, 80)} | id ${String(product?.id)}`).join(' ; ')}` : '',
    cart.length ? `Compact cart: ${cart.join(' ; ')}` : '',
    memory.visualSearchQuery ? `Recent visual search: ${memory.visualSearchQuery}` : '',
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : 'No remembered sales context yet.';
}
