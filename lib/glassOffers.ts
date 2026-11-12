import type { Product } from '@/lib/types';

// Initial selections are the owner's existing glass-bangle box listings.
// The admin can replace/add products without shipping code or changing checkout prices.
// Original/reference prices below are the owner's stated Rs. 3,000 comparison;
// they do not overwrite the catalog's actual product price.
export type GlassOfferItem = {
  productId: string;
  referencePrice?: number;
  /** Fixed selling price migrated from Weekly/Big Deals; active every day. */
  dealPrice?: number;
};

export type GlassOfferSettings = {
  /** Version 2 is an explicit, editable unified list; legacy schedules seed it once. */
  collectionVersion?: 2;
  enabled: boolean;
  heading: string;
  subtitle: string;
  badge: string;
  items: GlassOfferItem[];
};

export const STARTER_GLASS_OFFERS: GlassOfferItem[] = [
  { productId: 'kDCUTfgmjLsSg2PuMLSP', referencePrice: 3000 }, // former style 14
  { productId: 'viPEssg9r6M72zjcSMoV', referencePrice: 3000 }, // 13
  { productId: 'WPbJ0espDZc5fqEBZEja', referencePrice: 3000 }, // 12
  { productId: '1qABfsZcsw66eDYTmeMJ', referencePrice: 3000 }, // 10
  { productId: '4IvjLG6PXhwmExSe0I0G', referencePrice: 3000 }, // 11
  { productId: 'jHsvs5C46CzAmoBNr89K', referencePrice: 3000 }, // 7
  { productId: '1T2BYTBsgyw88m1UhoPT', referencePrice: 3000 }, // 8
  { productId: 'hduQ4h9JM8XkoLSn3i4A', referencePrice: 3000 }, // 9
  { productId: 'vsc4IbWRrDO1kz2IGygZ', referencePrice: 3000 }, // 4
  { productId: 'IZZhqv1V5MLRjoO1z48T', referencePrice: 3000 }, // 5
  { productId: 'yDZOmedwGnq3mvFZJcfn', referencePrice: 3000 }, // 3
  { productId: '5Zx0JhTAhX8MaCsn74lY', referencePrice: 3000 }, // 2
];

// The twelve owner-designated glass-box listings are exclusive to this promo.
// Keep database category and product URLs intact to preserve carts/orders.
const EXCLUSIVE_GLASS_DEAL_IDS = new Set(STARTER_GLASS_OFFERS.map((item) => item.productId));

export function isExclusiveGlassDealProduct(product: { id?: string } | string): boolean {
  return EXCLUSIVE_GLASS_DEAL_IDS.has(typeof product === 'string' ? product : String(product.id || ''));
}

export const DEFAULT_GLASS_OFFERS: GlassOfferSettings = {
  enabled: true,
  heading: 'Mega Deals',
  subtitle: 'More choice. Special prices. All in one place.',
  badge: 'SPECIAL OFFERS',
  items: STARTER_GLASS_OFFERS,
};

export function resolveGlassOffers(raw?: Partial<GlassOfferSettings> | null): GlassOfferSettings {
  if (!raw) return DEFAULT_GLASS_OFFERS;
  const seen = new Set<string>();
  const items = (Array.isArray(raw.items) ? raw.items : STARTER_GLASS_OFFERS)
    .map((item) => ({
      productId: String(item?.productId || '').trim(),
      referencePrice: Number.isFinite(Number(item?.referencePrice)) && Number(item?.referencePrice) > 0 ? Number(item.referencePrice) : undefined,
      dealPrice: Number.isFinite(Number(item?.dealPrice)) && Number(item?.dealPrice) > 0 ? Number(item.dealPrice) : undefined,
    }))
    .filter((item) => {
      if (!item.productId || seen.has(item.productId)) return false;
      seen.add(item.productId);
      return true;
    })
    .slice(0, 100);
  return {
    ...(raw.collectionVersion === 2 ? { collectionVersion: 2 as const } : {}),
    enabled: raw.enabled !== false,
    heading: typeof raw.heading === 'string' && raw.heading.trim() ? raw.heading.trim().slice(0, 90) : DEFAULT_GLASS_OFFERS.heading,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim().slice(0, 180) : DEFAULT_GLASS_OFFERS.subtitle,
    badge: typeof raw.badge === 'string' && raw.badge.trim() ? raw.badge.trim().slice(0, 28) : DEFAULT_GLASS_OFFERS.badge,
    items,
  };
}

export type DealCollectionSource = {
  glassDealShowcase?: Partial<GlassOfferSettings> | null;
  weeklyDeals?: Array<{ productId?: string; active?: boolean; originalPrice?: number; dealPrice?: number }>;
  bigDeal?: Record<string, any> | null;
  dailyDeal?: Record<string, any> | null;
};

/** Read-only migration: keep IDs and catalog prices, retire day locks and rotation. */
export function resolveUnifiedDealCollection(source: DealCollectionSource = {}): GlassOfferSettings {
  const saved = source.glassDealShowcase;
  const config = resolveGlassOffers(saved);
  if (saved?.collectionVersion === 2) return config;
  const items = [...config.items];
  for (const deal of source.weeklyDeals || []) {
    if (deal.active !== false && deal.productId) {
      items.push({ productId: deal.productId, referencePrice: Number(deal.originalPrice) || undefined, dealPrice: Number(deal.dealPrice) || undefined });
    }
  }
  // The dedicated Big Deal is authoritative; dailyDeal is its historical alias.
  const big = source.bigDeal ?? source.dailyDeal;
  if (big?.active === true) {
    const ids = Array.isArray(big.productIds) ? big.productIds : [];
    [...ids, big.productId].forEach((id, index) => {
      if (id) items.push({ productId: String(id), referencePrice: Number(big.originalPrices?.[index] || big.originalPrice) || undefined,
        dealPrice: Number(big.dealPrices?.[index] ?? big.dealPrice) || undefined });
    });
  }
  return resolveGlassOffers({ ...config, collectionVersion: 2, items,
    // Retire old glass-only defaults, while preserving a custom collection name.
    heading: !saved?.heading || /^(Glass Bangles Mega Deals|70% OFF.*)$/i.test(saved.heading.trim()) ? DEFAULT_GLASS_OFFERS.heading : saved.heading,
    subtitle: !saved?.subtitle || saved.subtitle === 'Colorful deal boxes and more offers, all in one place.' ? DEFAULT_GLASS_OFFERS.subtitle : saved.subtitle,
    badge: DEFAULT_GLASS_OFFERS.badge,
  });
}

/** Keep every storefront surface and variant on the same configured deal price. */
export function applyCollectionPrice<T extends { id?: string; price?: unknown; [key: string]: any }>(product: T, raw?: Partial<GlassOfferSettings> | null): T {
  const config = resolveGlassOffers(raw);
  const item = config.enabled ? config.items.find(entry => entry.productId === String(product.id || '')) : undefined;
  if (!item) return product;
  const price = Number(item.dealPrice) > 0 ? Number(item.dealPrice) : Number(product.price);
  if (!Number.isFinite(price) || price <= 0) return product;
  const reference = Number(item.referencePrice) || Math.max(Number(product.originalPrice) || 0, Number(product.compareAtPrice) || 0);
  const rows = (value: unknown) => Array.isArray(value) ? value.map(row => ({ ...row, price })) : value;
  return { ...product, price, megaDealPrice: price,
    ...(reference > price ? { originalPrice: reference, compareAtPrice: reference } : {}),
    ...(Array.isArray(product.variantMatrix) ? { variantMatrix: rows(product.variantMatrix) } : {}),
    ...(Array.isArray(product.variants) ? { variants: rows(product.variants) } : {}),
  };
}

/** Same public settings for home, product detail, cart and authoritative checkout. */
export function unifyStorefrontDeals<T extends DealCollectionSource>(source: T) {
  return { ...source, glassDealShowcase: resolveUnifiedDealCollection(source), weeklyDeals: [],
    dailyDeal: source.dailyDeal ? { ...source.dailyDeal, active: false } : undefined,
    bigDeal: source.bigDeal ? { ...source.bigDeal, active: false } : undefined,
  };
}

export type GlassOfferDisplay = {
  product: Product;
  price: number;
  referencePrice: number;
  savingPercent: number;
};

export function resolveGlassOfferProducts(
  products: Product[],
  raw?: Partial<GlassOfferSettings> | null,
): GlassOfferDisplay[] {
  const config = resolveGlassOffers(raw);
  if (!config.enabled) return [];
  const map = new Map(products.map((product) => [String(product.id), product]));
  return config.items.flatMap((item) => {
    const stored = map.get(item.productId);
    if (!stored || stored.active === false || stored.published === false) return [];
    const product = applyCollectionPrice(stored, config);
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) return [];
    const catalogReference = Math.max(Number(product.originalPrice) || 0, Number(product.compareAtPrice) || 0);
    const reference = Number(item.referencePrice) || catalogReference;
    const referencePrice = Number.isFinite(reference) && reference > price ? reference : 0;
    const savingPercent = referencePrice ? Math.round((1 - price / referencePrice) * 100) : 0;
    return [{ product, price, referencePrice, savingPercent }];
  });
}
