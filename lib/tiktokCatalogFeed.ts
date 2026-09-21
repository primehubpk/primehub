import 'server-only';

import { bigDealConfiguredSlotCount, bigDealRotationIndex } from '@/lib/bigDealRotation';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { matchesSaleMelaBucket } from '@/lib/priceBucketUtils';
import { PRIME_SKILLS_SEED } from '@/lib/primeSkillsSeed';
import { isWholesaleProduct } from '@/lib/wholesale';
import { pakistanNowWeekday } from '@/lib/weeklyDealUtils';

export const PRODUCT_FEED_HEADERS = [
  'sku_id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'product_type',
  'sale_price',
  'shipping_weight',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
  'custom_label_3',
  'custom_label_4',
] as const;

export const SKILL_FEED_HEADERS = [
  'item_id',
  'title',
  'image_link',
  'description',
  'link',
  'availability',
  'price',
  'sale_price',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
  'custom_label_3',
  'custom_label_4',
] as const;

type FeedRow = Record<string, string>;
type SettingsShape = Record<string, any>;

const CANONICAL_SITE_ORIGIN = 'https://www.primehubmall.com';
const TECHNICAL_BOOLEAN_FIELDS = new Set([
  'active',
  'published',
  'hasvariants',
  'hidden',
  'disabled',
]);

function text(value: unknown, max = 20_000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function titleText(value: unknown) {
  return text(value, 500)
    .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu, ' ')
    .replace(/\b(?:free shipping|free delivery|wholesale(?: deal)?|limited[- ]time deal)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;\-])/g, '$1')
    .trim()
    .slice(0, 500);
}

function slugToken(value: unknown) {
  return text(value, 100)
    .toLowerCase()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function humanFeatureKey(value: string) {
  const stripped = value.replace(/^is(?=[A-Z_\-])/, '');
  return slugToken(stripped);
}

function money(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const fixed = Math.round(amount * 100) / 100;
  return `${Number.isInteger(fixed) ? fixed.toFixed(0) : fixed.toFixed(2)} PKR`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function rowsToCsv(headers: readonly string[], rows: FeedRow[]) {
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] || '')).join(',')),
  ].join('\r\n');
}

function imageToken(kind: 'p' | 's', id: string) {
  return `${kind}_${Buffer.from(id, 'utf8').toString('base64url')}.jpg`;
}

export function decodeImageToken(file: string) {
  const match = /^([ps])_([A-Za-z0-9_-]+)\.jpg$/i.exec(String(file || ''));
  if (!match) return null;
  try {
    return {
      kind: match[1].toLowerCase() as 'p' | 's',
      id: Buffer.from(match[2], 'base64url').toString('utf8'),
    };
  } catch {
    return null;
  }
}

function imageProxyUrl(requestOrigin: string, kind: 'p' | 's', id: string, _version?: unknown) {
  const origin = String(requestOrigin || CANONICAL_SITE_ORIGIN).replace(/\/+$/, '');
  const token = imageToken(kind, id);
  return `${origin}/api/tiktok/catalog/image/${token}`;
}

function productImage(product: any) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const candidates = [product?.imageUrl, product?.image, ...images]
    .map((item) => typeof item === 'string' ? item : item?.url)
    .map((item) => normalizeImageUrl(String(item || '')))
    .filter(Boolean);
  return candidates[0] || '';
}

function skillImage(skill: any) {
  return normalizeImageUrl(
    String(skill?.thumbnailUrl || skill?.imageUrl || skill?.image || ''),
  );
}

function explicitStock(product: any): number | null {
  const rows = [
    ...(Array.isArray(product?.variantMatrix) ? product.variantMatrix : []),
    ...(Array.isArray(product?.variants) ? product.variants : []),
  ].filter((row) => row?.active !== false && row?.hidden !== true);

  const rowsWithStock = rows.filter((row) => row?.stock !== undefined && row?.stock !== null && row?.stock !== '');
  if (rowsWithStock.length) {
    return rowsWithStock.reduce((sum, row) => sum + Math.max(0, Number(row.stock || 0)), 0);
  }

  const raw = product?.stock ?? product?.quantity ?? product?.inventory;
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function availability(product: any) {
  const stock = explicitStock(product);
  if (stock === 0) return 'out of stock';
  if (stock === null) return 'available for order';
  return 'in stock';
}

function categoryLookup(categories: any[]) {
  const map = new Map<string, string>();
  for (const category of categories || []) {
    const label = text(category?.title || category?.name || category?.slug || category?.id, 100);
    if (!label) continue;
    const keys = [category?.id, category?.slug, category?.title, category?.name]
      .map((value) => text(value, 120).toLowerCase())
      .filter(Boolean);
    for (const key of keys) map.set(key, label);
  }
  return map;
}

function productCategory(product: any, categories: Map<string, string>) {
  const candidates = [product?.categoryId, product?.category]
    .map((value) => text(value, 120))
    .filter(Boolean);
  for (const candidate of candidates) {
    const resolved = categories.get(candidate.toLowerCase());
    if (resolved) return resolved;
  }
  return candidates[0] || 'Products';
}

function saleMelaLabel(price: number, wholesale: boolean) {
  if (wholesale) return 'wholesale';
  if (matchesSaleMelaBucket(price, 99)) return 'sale-mela-1-298';
  if (matchesSaleMelaBucket(price, 299)) return 'sale-mela-299-998';
  if (matchesSaleMelaBucket(price, 999)) return 'sale-mela-999-plus';
  return '';
}

function valueTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => ['string', 'number'].includes(typeof item))
      .map((item) => slugToken(item))
      .filter(Boolean);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const token = slugToken(value);
    return token ? [token] : [];
  }
  return [];
}

function dynamicFeatureTokens(item: Record<string, any>, bucketNames: string[] = []) {
  const tokens = new Set<string>();
  for (const bucket of bucketNames) {
    const token = slugToken(bucket);
    if (token) tokens.add(token);
  }

  for (const [key, value] of Object.entries(item || {})) {
    const normalizedKey = key.toLowerCase();
    if (typeof value === 'boolean' && value && !TECHNICAL_BOOLEAN_FIELDS.has(normalizedKey)) {
      const token = humanFeatureKey(key);
      if (token) tokens.add(token);
      continue;
    }

    if (/(tag|label|badge|collection|campaign|feature|bucket)/i.test(key)) {
      for (const token of valueTokens(value)) tokens.add(token);
    }
  }

  const joined: string[] = [];
  let length = 0;
  for (const token of tokens) {
    const extra = token.length + (joined.length ? 1 : 0);
    if (length + extra > 100) break;
    joined.push(token);
    length += extra;
  }
  return joined.join('|');
}

function shippingWeight(product: any) {
  for (const [key, raw] of Object.entries(product || {})) {
    if (!/weight/i.test(key) || raw === null || raw === undefined || raw === '') continue;

    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const value = Number((raw as any).value ?? (raw as any).amount);
      const unit = text((raw as any).unit, 12).toLowerCase();
      if (Number.isFinite(value) && value > 0 && /^(kg|g|lb|oz)$/.test(unit)) {
        return `${value} ${unit}`;
      }
      continue;
    }

    const rawText = text(raw, 40).toLowerCase();
    if (/^\d+(?:\.\d+)?\s*(kg|g|lb|oz)$/.test(rawText)) return rawText;

    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    const normalizedKey = key.toLowerCase();
    if (/kg|kilogram/.test(normalizedKey)) return `${value} kg`;
    if (/gram|(^|_)g($|_)/.test(normalizedKey)) return `${value} g`;
    if (/lb|pound/.test(normalizedKey)) return `${value} lb`;
    if (/oz|ounce/.test(normalizedKey)) return `${value} oz`;
  }
  return '';
}

function activeWindow(deal: any, now: Date) {
  if (!deal || deal.active === false) return false;
  const start = deal.startAt ? new Date(deal.startAt).getTime() : Number.NEGATIVE_INFINITY;
  const end = deal.endAt ? new Date(deal.endAt).getTime() : Number.POSITIVE_INFINITY;
  const current = now.getTime();
  return (!Number.isFinite(start) || current >= start) && (!Number.isFinite(end) || current < end);
}

function bigDealState(settings: SettingsShape, productId: string, now: Date) {
  const deal = settings?.dailyDeal || settings?.bigDeal;
  if (!deal || deal.active === false) return { state: '', live: false, price: 0, regular: 0 };

  const productIds = Array.isArray(deal.productIds) ? deal.productIds.map((id: unknown) => text(id, 160)) : [];
  const index = productIds.findIndex((id: string) => id === productId);
  const legacyMatch = text(deal.productId, 160) === productId;
  const belongs = index >= 0 || legacyMatch;
  if (!belongs) return { state: '', live: false, price: 0, regular: 0 };

  const slotCount = bigDealConfiguredSlotCount(deal);
  const activeIndex = bigDealRotationIndex(deal.rotationStartedAt, now, slotCount);
  const activeProductId = text(productIds[activeIndex] || deal.productId || productIds[0], 160);
  const live = activeWindow(deal, now) && activeProductId === productId;

  if (!live) return { state: 'big-deal-locked', live: false, price: 0, regular: 0 };

  const prices = Array.isArray(deal.dealPrices) ? deal.dealPrices : [];
  const originals = Array.isArray(deal.originalPrices) ? deal.originalPrices : [];
  return {
    state: 'big-deal-live',
    live: true,
    price: Number(prices[activeIndex] ?? deal.dealPrice ?? 0),
    regular: Number(originals[activeIndex] ?? deal.originalPrice ?? 0),
  };
}

function weeklyDealState(settings: SettingsShape, productId: string, now: Date) {
  const deals = Array.isArray(settings?.weeklyDeals) ? settings.weeklyDeals : [];
  const deal = deals.find((item: any) => item?.active !== false && text(item?.productId, 160) === productId);
  if (!deal) return { state: '', live: false, price: 0, regular: 0 };

  const day = text(deal.day, 20).toLowerCase();
  const live = day && day === pakistanNowWeekday(now);
  return {
    state: live ? 'weekly-deal-live' : `weekly-deal-locked-${slugToken(day)}`,
    live: Boolean(live),
    price: Number(deal.dealPrice || 0),
    regular: Number(deal.normalPrice || deal.originalPrice || 0),
  };
}

function priceState(product: any, settings: SettingsShape, now: Date) {
  const productId = text(product?.id, 160);
  const current = Number(product?.price || 0);
  const original = Number(product?.originalPrice ?? product?.compareAtPrice ?? current);
  const baseRegular = original > current && current > 0 ? original : current;
  let regular = baseRegular;
  let sale = original > current && current > 0 ? current : 0;
  let state = sale > 0 ? 'discount' : 'regular';
  let bigDealLink = false;

  const weekly = weeklyDealState(settings, productId, now);
  const big = bigDealState(settings, productId, now);

  if (big.live && big.price > 0) {
    regular = big.regular > 0 ? big.regular : current || baseRegular;
    sale = big.price;
    state = big.state;
    bigDealLink = true;
  } else if (weekly.live && weekly.price > 0) {
    // Mirrors the storefront: a live weekly deal uses the product's current
    // catalog price as its normal price before applying the one-day deal price.
    regular = current > 0 ? current : weekly.regular || baseRegular;
    sale = weekly.price;
    state = weekly.state;
  } else if (weekly.state) {
    state = weekly.state;
  } else if (big.state) {
    state = big.state;
  }

  if (!(regular > 0)) regular = current;
  if (sale > 0 && sale >= regular && (state === 'weekly-deal-live' || state === 'big-deal-live')) {
    // Defensive parity with the storefront if an old/manual deal was saved
    // above its displayed normal price: the deal value is still what the
    // customer sees, so publish it as the current price rather than a fake sale.
    regular = sale;
    sale = 0;
  } else if (!(sale > 0 && sale < regular)) {
    sale = 0;
  }

  return {
    regular,
    sale,
    current: sale || regular,
    state,
    bigDealLink,
    inBigDealRotation: Boolean(big.state),
    inWeeklyDeal: Boolean(weekly.state),
  };
}

function bucketNamesForProduct(product: any, settings: SettingsShape) {
  const selected = new Set(
    (Array.isArray(product?.priceBucketIds) ? product.priceBucketIds : [])
      .map((value: unknown) => text(value, 160))
      .filter(Boolean),
  );
  const buckets = Array.isArray(settings?.priceBuckets) ? settings.priceBuckets : [];
  return buckets
    .filter((bucket: any) => selected.has(text(bucket?.id, 160)))
    .map((bucket: any) => text(bucket?.title || bucket?.id, 100))
    .filter(Boolean);
}

export function buildProductFeedRows(input: {
  products: any[];
  categories: any[];
  settings: SettingsShape;
  requestOrigin: string;
  now?: Date;
}) {
  const now = input.now || new Date();
  const categories = categoryLookup(input.categories);
  const rows: FeedRow[] = [];
  let skipped = 0;

  for (const product of input.products || []) {
    if (!product || product.active === false || product.published === false) continue;

    const id = text(product.id, 160);
    const rawTitle = product.title || product.name;
    const title = titleText(rawTitle);
    const sourceImage = productImage(product);
    const price = priceState(product, input.settings, now);
    if (!id || !title || !sourceImage || !(price.regular > 0)) {
      skipped += 1;
      continue;
    }

    const wholesale = isWholesaleProduct(product);
    const category = productCategory(product, categories);
    const bucketNames = bucketNamesForProduct(product, input.settings);
    const dealFeatures = [
      price.inBigDealRotation ? 'big-deal-rotation' : '',
      price.inWeeklyDeal ? 'weekly-deal' : '',
    ].filter(Boolean);

    const featureLabel = dynamicFeatureTokens(
      {
        ...product,
        feedDealFeatures: dealFeatures,
      },
      bucketNames,
    );

    const landing = new URL(`/product/${encodeURIComponent(id)}`, CANONICAL_SITE_ORIGIN);
    if (price.bigDealLink) landing.searchParams.set('deal', 'big');

    rows.push({
      sku_id: id,
      title,
      description: text(product.description || rawTitle || title, 20_000) || title,
      availability: availability(product),
      condition: 'new',
      price: money(price.regular),
      link: landing.toString(),
      image_link: imageProxyUrl(input.requestOrigin, 'p', id, product.updatedAt || product.createdAt),
      brand: text(product.brand || 'PrimeHubMall', 100) || 'PrimeHubMall',
      product_type: category,
      sale_price: money(price.sale),
      shipping_weight: shippingWeight(product),
      custom_label_0: wholesale ? 'wholesale' : 'retail',
      custom_label_1: text(category, 100),
      custom_label_2: saleMelaLabel(price.current, wholesale),
      custom_label_3: text(price.state, 100),
      custom_label_4: featureLabel,
    });
  }

  return { rows, skipped };
}

function skillDisplayPrice(skill: any) {
  const packages = (Array.isArray(skill?.packages) ? skill.packages : [])
    .filter((pkg: any) => pkg?.active !== false && Number(pkg?.price || 0) > 0);
  if (packages.length) return Math.min(...packages.map((pkg: any) => Number(pkg.price)));
  return Number(skill?.price || 0);
}

export function buildSkillFeedRows(input: {
  skills: any[];
  requestOrigin: string;
}) {
  const source = input.skills?.length ? input.skills : PRIME_SKILLS_SEED;
  const rows: FeedRow[] = [];
  let skipped = 0;

  for (const skill of source) {
    if (!skill || skill.active === false) continue;
    const id = text(skill.id, 160);
    const title = titleText(skill.title || skill.name);
    const sourceImage = skillImage(skill);
    if (!id || !title || !sourceImage) {
      skipped += 1;
      continue;
    }

    const packages = (Array.isArray(skill.packages) ? skill.packages : [])
      .filter((pkg: any) => pkg?.active !== false);
    const price = skillDisplayPrice(skill);

    rows.push({
      item_id: id,
      title,
      image_link: imageProxyUrl(input.requestOrigin, 's', id, skill.updatedAt || skill.createdAt),
      description: text(skill.subtitle || skill.description || title, 20_000) || title,
      link: `${CANONICAL_SITE_ORIGIN}/skills/${encodeURIComponent(id)}`,
      availability: 'in stock',
      price: money(price),
      sale_price: '',
      custom_label_0: 'prime-skills',
      custom_label_1: text(skill.mediaType || 'service', 100),
      custom_label_2: packages.length ? `packages-${packages.length}` : 'single-service',
      custom_label_3: skill.externalUrl ? 'external-enabled' : 'primehub-detail',
      custom_label_4: dynamicFeatureTokens(skill),
    });
  }

  return { rows, skipped };
}

export function sourceImageForProduct(product: any) {
  return productImage(product);
}

export function sourceImageForSkill(skill: any) {
  return skillImage(skill);
}
