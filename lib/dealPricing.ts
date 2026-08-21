export const DEAL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DealDay = (typeof DEAL_DAYS)[number];

export type DealPriceInput = {
  price: number;
  dealPrice?: number;
  dealDay?: string;
  isBigDeal?: boolean;
  isDailyDeal?: boolean;
  isFlashSale?: boolean;
  startAt?: string | number | Date;
  endAt?: string | number | Date;
  originalPrice?: number;
  normalPrice?: number;
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

function isTimestampActive(product: DealPriceInput, now: Date): boolean {
  const start = product.startAt == null ? NaN : new Date(product.startAt).getTime();
  const end = product.endAt == null ? NaN : new Date(product.endAt).getTime();
  if (Number.isFinite(start) && now.getTime() < start) return false;
  if (Number.isFinite(end) && now.getTime() >= end) return false;
  return Number.isFinite(start) || Number.isFinite(end);
}

/**
 * Unified price resolution. Active Big/Daily/Flash deals always win over a
 * selected variant's regular price. Scheduled weekly deals are evaluated in PKT.
 */
export function getEffectivePrice(product: any, selectedVariant?: any): number {
  const now = new Date();
  const dealPrice = Number(product?.dealPrice || 0);
  const regularPrice = Number(product?.price || 0);
  const activeByFlag = Boolean(product?.isBigDeal || product?.isDailyDeal || product?.isFlashSale);
  const activeByTimestamp = isTimestampActive(product || {}, now);
  const activeByWeekday = isDealActive(product?.dealDay, now);

  if ((activeByFlag || activeByTimestamp || activeByWeekday) && dealPrice > 0) {
    return dealPrice;
  }

  if (selectedVariant && Number(selectedVariant.price) > 0) {
    return Number(selectedVariant.price);
  }

  return dealPrice > 0 ? dealPrice : regularPrice;
}

export function getDealStatus(dealDay?: string, now = new Date()) {
  if (!dealDay || !DEAL_DAYS.includes(dealDay as DealDay)) return 'regular' as const;
  if (isDealActive(dealDay, now)) return 'active' as const;
  return 'scheduled' as const;
}
