import { getPakistanDay } from './dealPricing';

type WeeklyCartDeal = { day?: string; active?: boolean; dealPrice?: number | string; normalPrice?: number | string; originalPrice?: number | string };
type WeeklyCartProduct = { price?: number | string; normalPrice?: number | string; originalPrice?: number | string; compareAtPrice?: number | string } | null | undefined;

export function weeklyCartPrice(deal: WeeklyCartDeal, product: WeeklyCartProduct, now = new Date()) {
  const regular = Number(deal.normalPrice) || Number(deal.originalPrice) ||
    Number(product?.normalPrice) || Number(product?.originalPrice) ||
    Number(product?.compareAtPrice) || Number(product?.price) || 0;
  const special = Number(deal.dealPrice) || 0;
  const live = deal.active !== false &&
    String(deal.day || '').toLowerCase() === getPakistanDay(now).toLowerCase() &&
    special > 0 && special < regular;
  return { price: live ? special : regular, regular, live };
}
