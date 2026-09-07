import 'server-only';

export type SalesIntentKind =
  | 'greeting'
  | 'product_search'
  | 'comparison'
  | 'deal'
  | 'wholesale'
  | 'delivery'
  | 'policy'
  | 'order'
  | 'support'
  | 'general';

export type SalesIntent = {
  kind: SalesIntentKind;
  wantsProducts: boolean;
  confidence: 'high' | 'medium' | 'low';
  filters: {
    minPrice?: number;
    maxPrice?: number;
    targetPrice?: number;
    category?: string;
    subcategory?: string;
    color?: string;
    material?: string;
    quantity?: number;
  };
  followUp: {
    more: boolean;
    cheaper: boolean;
    pricier: boolean;
    compare: boolean;
    referencedPosition?: number;
  };
  terms: string[];
  needsReasoning: boolean;
  summary: string;
};

type CatalogLike = {
  products?: any[];
  categories?: any[];
};

const STOP_WORDS = new Set([
  'mujhe', 'muje', 'mery', 'mere', 'meri', 'mera', 'hum', 'ham', 'koi', 'kuch', 'aur', 'or', 'more', 'next', 'mazeed', 'mazid',
  'show', 'dikhao', 'dikha', 'dikhaye', 'dikhain', 'chahiye', 'chahi', 'chaheye', 'price', 'rate', 'budget', 'under', 'below',
  'tak', 'se', 'kam', 'zyada', 'jada', 'ka', 'ki', 'ke', 'hai', 'hain', 'please', 'plz', 'want', 'need', 'product', 'products',
  'item', 'items', 'wali', 'wale', 'wala', 'andar', 'mein', 'mai', 'me', 'for', 'the', 'a', 'an', 'rs', 'pkr', 'rupees', 'rupee',
]);

function normalize(value: unknown): string {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[^a-z0-9\s.-]/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

function numberValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.toLowerCase().replace(/[,\s]/g, '');
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(k)?$/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  return Math.round(value * (match[2] ? 1000 : 1));
}

function firstMoneyMatch(value: string, regex: RegExp, group = 1): number | undefined {
  const match = value.match(regex);
  return numberValue(match?.[group]);
}

function parsePriceFilters(message: string) {
  const value = normalize(message);
  const result: { minPrice?: number; maxPrice?: number; targetPrice?: number } = {};

  const range = value.match(/(?:rs\s*|pkr\s*)?(\d+(?:\.\d+)?\s*k?)\s*(?:se|to|-)\s*(?:rs\s*|pkr\s*)?(\d+(?:\.\d+)?\s*k?)(?:\s*(?:tak|range|mein|mai|me))?/i);
  if (range) {
    const first = numberValue(range[1]);
    const second = numberValue(range[2]);
    if (first != null && second != null && (first >= 20 || second >= 20)) {
      result.minPrice = Math.min(first, second);
      result.maxPrice = Math.max(first, second);
      return result;
    }
  }

  const maxPrice =
    firstMoneyMatch(value, /(?:under|below|max(?:imum)?|budget(?:\s+is)?|andar|tak|se\s+kam)\s*(?:rs\s*|pkr\s*)?(\d+(?:\.\d+)?\s*k?)/i)
    ?? firstMoneyMatch(value, /(?:rs\s*|pkr\s*)?(\d+(?:\.\d+)?\s*k?)\s*(?:tak|ke\s+andar|se\s+kam|wali|wale|wala)(?:\s|$)/i);
  if (maxPrice != null && maxPrice >= 1) result.maxPrice = maxPrice;

  const minPrice =
    firstMoneyMatch(value, /(?:above|over|min(?:imum)?|se\s+zyada|se\s+jada)\s*(?:rs\s*|pkr\s*)?(\d+(?:\.\d+)?\s*k?)/i)
    ?? firstMoneyMatch(value, /(?:rs\s*|pkr\s*)?(\d+(?:\.\d+)?\s*k?)\s*(?:se\s+zyada|se\s+jada)(?:\s|$)/i);
  if (minPrice != null && minPrice >= 1) result.minPrice = minPrice;

  if (result.minPrice == null && result.maxPrice == null) {
    const explicit = firstMoneyMatch(value, /(?:rs|pkr|rupees?|price)\s*(\d+(?:\.\d+)?\s*k?)/i);
    if (explicit != null) result.targetPrice = explicit;
  }

  return result;
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
    if (item && typeof item === 'object') {
      const candidate = (item as any).name || (item as any).label || (item as any).value || (item as any).color || (item as any).material;
      return typeof candidate === 'string' && candidate.trim() ? [candidate.trim()] : [];
    }
    return [];
  });
}

function uniqueValues(values: string[]): string[] {
  const map = new Map<string, string>();
  for (const value of values) {
    const key = normalize(value);
    if (!key || key.length < 2) continue;
    if (!map.has(key)) map.set(key, value.trim());
  }
  return [...map.values()].sort((a, b) => normalize(b).length - normalize(a).length);
}

function bestContained(message: string, values: string[]): string | undefined {
  const normalizedMessage = ` ${normalize(message)} `;
  for (const value of uniqueValues(values)) {
    const candidate = normalize(value);
    if (candidate && normalizedMessage.includes(` ${candidate} `)) return value;
  }
  return undefined;
}

function catalogVocabulary(catalog: CatalogLike) {
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
  return {
    categories: uniqueValues([
      ...categories.flatMap((category) => [category?.name, category?.slug].filter((value): value is string => typeof value === 'string')),
      ...products.flatMap((product) => stringValues(product?.category)),
    ]),
    subcategories: uniqueValues(products.flatMap((product) => stringValues(product?.subcategory))),
    colors: uniqueValues(products.flatMap((product) => [...stringValues(product?.color), ...stringValues(product?.colors), ...stringValues(product?.variantColors)])),
    materials: uniqueValues(products.flatMap((product) => [...stringValues(product?.material), ...stringValues(product?.materials)])),
  };
}

function parseQuantity(value: string): number | undefined {
  const match = normalize(value).match(/\b(\d{1,3})\s*(?:pcs?|pieces?|pair|pairs|sets?|boxes?|box|qty|quantity)\b/i);
  if (!match) return undefined;
  const quantity = Number(match[1]);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : undefined;
}

function referencedPosition(value: string): number | undefined {
  const normalized = normalize(value);
  const numeric = normalized.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:wala|wali|one|product|item)?\b/i);
  if (numeric) {
    const n = Number(numeric[1]);
    if (n >= 1 && n <= 30) return n;
  }
  const words: Array<[RegExp, number]> = [
    [/\b(?:first|pehla|pehli)\b/i, 1],
    [/\b(?:second|dusra|doosra|dusri|doosri)\b/i, 2],
    [/\b(?:third|teesra|tisra|teesri|tisri)\b/i, 3],
    [/\b(?:fourth|chautha|chotha)\b/i, 4],
    [/\b(?:fifth|panchwa|panchvi)\b/i, 5],
  ];
  return words.find(([regex]) => regex.test(normalized))?.[1];
}

function termsFromMessage(message: string): string[] {
  return normalize(message)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word) && !/^\d+(?:\.\d+)?k?$/.test(word))
    .slice(0, 12);
}

function inferKind(message: string, wantsProducts: boolean, compare: boolean): SalesIntentKind {
  const value = normalize(message);
  if (/^(hi|hello|hey|salam|assalam|aoa|asalam)\b/.test(value)) return 'greeting';
  if (/(complain|complaint|angry|ghussa|gussa|fraud|payment.*(?:stuck|issue|masla)|not working|problem)/i.test(value)) return 'support';
  if (/(return|exchange|refund|policy|privacy|terms|warranty)/i.test(value)) return 'policy';
  if (/(delivery|shipping|dispatch|courier|cod|cash on delivery)/i.test(value)) return 'delivery';
  if (/(checkout|cart|order|advance|ready|payment|confirm order|lock order)/i.test(value)) return 'order';
  if (/(wholesale|reseller|resale|bulk|dealer)/i.test(value)) return 'wholesale';
  if (/(big deal|deal|offer|discount|sale|promotion|promo)/i.test(value) && !wantsProducts) return 'deal';
  if (compare) return 'comparison';
  if (wantsProducts) return 'product_search';
  return 'general';
}

export function parseSalesIntent(message: string, catalog: CatalogLike): SalesIntent {
  const value = normalize(message);
  const vocabulary = catalogVocabulary(catalog);
  const price = parsePriceFilters(message);
  const category = bestContained(message, vocabulary.categories);
  const subcategory = bestContained(message, vocabulary.subcategories);
  const color = bestContained(message, vocabulary.colors);
  const material = bestContained(message, vocabulary.materials);
  const quantity = parseQuantity(message);
  const more = /^(?:aur|or|more|next|mazeed|mazid|baqi|baaki)(?:\s+(?:dikha|dikhao|show|products?|items?))?[!.?]*$/i.test(value)
    || /^(?:aur|more|next)\s+(?:dikha|dikhao|show)/i.test(value);
  const cheaper = /(sasta|sasti|cheaper|less price|kam price|thora kam|thori kam)/i.test(value);
  const pricier = /(mehnga|mehngi|premium|expensive|higher price|zyada price)/i.test(value);
  const compare = /(compare|comparison|better|best|which one|konsa acha|kaunsa acha|farq|difference|vs\b)/i.test(value);
  const reference = referencedPosition(message);
  const explicitProductLanguage = /(bangle|bangles|kara|karray|jewel|jewellery|watch|product|item|set|gift|dikha|show|chahi|price|rate|budget|under|below|wali|wale|wala)/i.test(value);
  const hasCatalogFilter = Boolean(category || subcategory || color || material || price.minPrice != null || price.maxPrice != null || price.targetPrice != null);
  const wantsProducts = explicitProductLanguage || hasCatalogFilter || more || cheaper || pricier || reference != null;
  const kind = inferKind(message, wantsProducts, compare);
  const terms = termsFromMessage(message);
  const ambiguousGeneral = kind === 'general' && terms.length > 2;
  const needsReasoning = kind === 'comparison' || ambiguousGeneral || /(?:recommend|suggest|best|acha|behtar|suitable|matching|match)/i.test(value);
  const confidence: SalesIntent['confidence'] = kind !== 'general' || hasCatalogFilter ? 'high' : terms.length ? 'medium' : 'low';

  const summaryParts = [
    `intent=${kind}`,
    category ? `category=${category}` : '',
    subcategory ? `subcategory=${subcategory}` : '',
    color ? `color=${color}` : '',
    material ? `material=${material}` : '',
    price.minPrice != null ? `minPrice=${price.minPrice}` : '',
    price.maxPrice != null ? `maxPrice=${price.maxPrice}` : '',
    price.targetPrice != null ? `targetPrice=${price.targetPrice}` : '',
    quantity != null ? `quantity=${quantity}` : '',
    more ? 'followUp=more' : '',
    cheaper ? 'followUp=cheaper' : '',
    pricier ? 'followUp=pricier' : '',
    reference != null ? `reference=${reference}` : '',
  ].filter(Boolean);

  return {
    kind,
    wantsProducts,
    confidence,
    filters: {
      ...price,
      category,
      subcategory,
      color,
      material,
      quantity,
    },
    followUp: {
      more,
      cheaper,
      pricier,
      compare,
      referencedPosition: reference,
    },
    terms,
    needsReasoning,
    summary: summaryParts.join('; '),
  };
}

function productText(product: any): string {
  const tags = stringValues(product?.tags).join(' ');
  const colors = [...stringValues(product?.color), ...stringValues(product?.colors), ...stringValues(product?.variantColors)].join(' ');
  const materials = [...stringValues(product?.material), ...stringValues(product?.materials)].join(' ');
  return normalize([
    product?.title,
    product?.name,
    product?.category,
    product?.subcategory,
    product?.description,
    colors,
    materials,
    tags,
  ].filter(Boolean).join(' '));
}

export function effectiveProductQuery(message: string, history: Array<{ role: string; text: string }>, catalog: CatalogLike): string {
  const current = parseSalesIntent(message, catalog);
  if (!current.followUp.more && !current.followUp.cheaper && !current.followUp.pricier) return message;
  for (const item of [...history].reverse()) {
    if (item.role !== 'customer') continue;
    const previous = parseSalesIntent(item.text, catalog);
    if (!previous.wantsProducts || previous.followUp.more) continue;
    return current.followUp.cheaper ? `${item.text} sasta` : current.followUp.pricier ? `${item.text} premium` : item.text;
  }
  return message;
}

export function rankProductsForIntent(products: any[], intent: SalesIntent, shownIds: string[]): any[] {
  if (!intent.wantsProducts) return [];
  const shown = new Set(shownIds.map(String));
  const structuredFilterPresent = Boolean(
    intent.filters.category || intent.filters.subcategory || intent.filters.color || intent.filters.material
    || intent.filters.minPrice != null || intent.filters.maxPrice != null || intent.filters.targetPrice != null
  );

  const candidates = products.filter((product) => {
    if (!product || product.id == null || product.active === false || shown.has(String(product.id))) return false;
    const hay = productText(product);
    const price = Number(product?.price || product?.salePrice || product?.retailPrice || 0);
    if (intent.filters.minPrice != null && (!Number.isFinite(price) || price < intent.filters.minPrice)) return false;
    if (intent.filters.maxPrice != null && (!Number.isFinite(price) || price > intent.filters.maxPrice)) return false;
    if (intent.filters.category && !hay.includes(normalize(intent.filters.category))) return false;
    if (intent.filters.subcategory && !hay.includes(normalize(intent.filters.subcategory))) return false;
    if (intent.filters.color && !hay.includes(normalize(intent.filters.color))) return false;
    if (intent.filters.material && !hay.includes(normalize(intent.filters.material))) return false;
    return true;
  });

  const scored = candidates.map((product) => {
    const hay = productText(product);
    const price = Number(product?.price || product?.salePrice || product?.retailPrice || 0);
    const termScore = intent.terms.reduce((score, term) => score + (hay.includes(normalize(term)) ? 2 : 0), 0);
    let score = termScore;
    if (intent.filters.category && hay.includes(normalize(intent.filters.category))) score += 8;
    if (intent.filters.subcategory && hay.includes(normalize(intent.filters.subcategory))) score += 6;
    if (intent.filters.color && hay.includes(normalize(intent.filters.color))) score += 5;
    if (intent.filters.material && hay.includes(normalize(intent.filters.material))) score += 5;
    if (intent.filters.targetPrice != null && Number.isFinite(price)) {
      score += Math.max(0, 5 - Math.abs(price - intent.filters.targetPrice) / Math.max(1, intent.filters.targetPrice) * 5);
    }
    return { product, score, price: Number.isFinite(price) ? price : 0 };
  });

  const hasTextTerms = intent.terms.length > 0;
  const meaningful = hasTextTerms && !structuredFilterPresent ? scored.filter((entry) => entry.score > 0) : scored;
  const source = meaningful;

  source.sort((a, b) => {
    if (intent.followUp.cheaper) return a.price - b.price || b.score - a.score;
    if (intent.followUp.pricier) return b.price - a.price || b.score - a.score;
    if (intent.filters.targetPrice != null) {
      const aDistance = Math.abs(a.price - intent.filters.targetPrice);
      const bDistance = Math.abs(b.price - intent.filters.targetPrice);
      if (aDistance !== bDistance) return aDistance - bDistance;
    }
    return b.score - a.score || a.price - b.price;
  });

  return source.map((entry) => entry.product);
}

export function intentNeedsLlm(intent: SalesIntent): boolean {
  if (intent.kind === 'support' || intent.kind === 'delivery' || intent.kind === 'policy' || intent.kind === 'order') return false;
  if (intent.kind === 'product_search' && !intent.needsReasoning) return false;
  if (intent.kind === 'greeting') return false;
  return intent.needsReasoning || intent.kind === 'general' || intent.kind === 'comparison' || intent.kind === 'deal';
}
