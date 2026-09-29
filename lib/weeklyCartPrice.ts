import { getPakistanDay } from './dealPricing';

type WeeklyCartDeal = { day?: string; active?: boolean; dealPrice?: number | string; normalPrice?: number | string; originalPrice?: number | string };
type WeeklyCartProduct = { price?: number | string; normalPrice?: number | string; originalPrice?: number | string; compareAtPrice?: number | string } | null | undefined;

export function weeklyCartPrice(deal: WeeklyCartDeal, product: WeeklyCartProduct, now = new Date()) {
  const regular = Number(deal.normalPrice) || Number(product?.normalPrice) ||
    Number(product?.price) || Number(deal.originalPrice) ||
    Number(product?.originalPrice) || Number(product?.compareAtPrice) || 0;
  const comparison = Math.max(regular, Number(product?.originalPrice) || 0,
    Number(product?.compareAtPrice) || 0, Number(deal.originalPrice) || 0);
  const special = Number(deal.dealPrice) || 0;
  const savings = special > 0 ? Math.max(0, comparison - special) : 0;
  const discount = comparison > 0 ? Math.round(savings / comparison * 100) : 0;
  const live = deal.active !== false &&
    String(deal.day || '').toLowerCase() === getPakistanDay(now).toLowerCase() &&
    special > 0 && special < regular;
  return { price: live ? special : regular, regular, comparison, savings, discount, live };
}
