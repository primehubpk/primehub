import { Timestamp } from 'firebase/firestore';

export const DEAL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DealDay = (typeof DEAL_DAYS)[number];

export type DealPriceInput = {
  price: number;
  dealPrice?: number;
  dealDay?: string;
};

/** Returns the current Pakistan (Asia/Karachi) weekday without relying on browser timezone. */
export function getPakistanDay(now = new Date()): DealDay {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'long',
  }).format(now) as DealDay;
}

/** A scheduled deal is active only when its assigned weekday is today's PKT weekday. */
export function isDealActive(dealDay?: string, now = new Date()): boolean {
  return !!dealDay && DEAL_DAYS.includes(dealDay as DealDay) && dealDay === getPakistanDay(now);
}

/**
 * Single pricing rule for product/cart/checkout UI.
 * Future and expired scheduled deals fall back to regular price.
 */
export function getEffectivePrice(product: DealPriceInput, now = new Date()): number {
  const regularPrice = Number(product.price || 0);
  const dealPrice = Number(product.dealPrice || 0);
  return isDealActive(product.dealDay, now) && dealPrice > 0 && dealPrice < regularPrice
    ? dealPrice
    : regularPrice;
}

export function getDealStatus(dealDay?: string, now = new Date()) {
  if (!dealDay || !DEAL_DAYS.includes(dealDay as DealDay)) return 'regular' as const;
  if (isDealActive(dealDay, now)) return 'active' as const;
  return 'scheduled' as const;
}
