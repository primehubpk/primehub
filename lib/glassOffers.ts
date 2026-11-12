import type { Product } from '@/lib/types';

// Initial selections are the owner's existing glass-bangle box listings.
// The admin can replace/add products without shipping code or changing checkout prices.
// Original/reference prices below are the owner's stated Rs. 3,000 comparison;
// they do not overwrite the catalog's actual product price.
export type GlassOfferItem = {
  productId: string;
  referencePrice?: number;
};

export type GlassOfferSettings = {
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
  heading: 'Glass Bangles Mega Deals',
  subtitle: 'Colorful deal boxes and more offers, all in one place.',
  badge: '70% OFF',
  items: STARTER_GLASS_OFFERS,
};

export function resolveGlassOffers(raw?: Partial<GlassOfferSettings> | null): GlassOfferSettings {
  if (!raw) return DEFAULT_GLASS_OFFERS;
  const seen = new Set<string>();
  const items = (Array.isArray(raw.items) ? raw.items : STARTER_GLASS_OFFERS)
    .map((item) => ({
      productId: String(item?.productId || '').trim(),
      referencePrice: Number(item?.referencePrice) > 0 ? Number(item.referencePrice) : undefined,
    }))
    .filter((item) => {
      if (!item.productId || seen.has(item.productId)) return false;
      seen.add(item.productId);
      return true;
    })
    .slice(0, 100);
  return {
    enabled: raw.enabled !== false,
    heading: typeof raw.heading === 'string' && raw.heading.trim() ? raw.heading.trim().slice(0, 90) : DEFAULT_GLASS_OFFERS.heading,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.trim().slice(0, 180) : DEFAULT_GLASS_OFFERS.subtitle,
    badge: typeof raw.badge === 'string' && raw.badge.trim() ? raw.badge.trim().slice(0, 28) : DEFAULT_GLASS_OFFERS.badge,
    items,
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
    const product = map.get(item.productId);
    if (!product || product.active === false || product.published === false) return [];
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) return [];
    const catalogReference = Math.max(Number(product.originalPrice) || 0, Number(product.compareAtPrice) || 0);
    const reference = Number(item.referencePrice) || catalogReference;
    const referencePrice = Number.isFinite(reference) && reference > price ? reference : 0;
    const savingPercent = referencePrice ? Math.round((1 - price / referencePrice) * 100) : 0;
    return [{ product, price, referencePrice, savingPercent }];
  });
}
