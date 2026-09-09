const SLOT_COUNT = 7;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

type BigDealRotationShape = {
  imageUrls?: unknown[];
  productIds?: unknown[];
  titles?: unknown[];
  originalPrices?: unknown[];
  dealPrices?: unknown[];
};

function pakistanDayOrdinal(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value || 1);
  const day = Number(parts.find((part) => part.type === 'day')?.value || 1);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function fallbackWeekdayIndex(now: Date) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' })
    .format(now)
    .toLowerCase();
  const index = WEEKDAYS.indexOf(weekday);
  return index >= 0 ? index : 0;
}

function normalizedSlotCount(slotCount = SLOT_COUNT) {
  const value = Math.floor(Number(slotCount) || 0);
  return Math.max(1, Math.min(SLOT_COUNT, value || SLOT_COUNT));
}

export function bigDealConfiguredSlotCount(deal?: BigDealRotationShape | null) {
  if (!deal) return 1;
  const images = Array.isArray(deal.imageUrls) ? deal.imageUrls : [];
  const productIds = Array.isArray(deal.productIds) ? deal.productIds : [];
  const titles = Array.isArray(deal.titles) ? deal.titles : [];
  const originalPrices = Array.isArray(deal.originalPrices) ? deal.originalPrices : [];
  const dealPrices = Array.isArray(deal.dealPrices) ? deal.dealPrices : [];

  let count = 0;
  for (let index = 0; index < SLOT_COUNT; index += 1) {
    const original = Number(originalPrices[index] || 0);
    const special = Number(dealPrices[index] || 0);
    const complete = Boolean(
      String(images[index] || '').trim() &&
      String(productIds[index] || '').trim() &&
      String(titles[index] || '').trim() &&
      original > 0 && special > 0 && special < original,
    );
    if (!complete) break;
    count += 1;
  }
  return Math.max(1, count);
}

export function bigDealRotationIndex(rotationStartedAt?: string, now = new Date(), slotCount = SLOT_COUNT) {
  const count = normalizedSlotCount(slotCount);
  if (rotationStartedAt) {
    const start = new Date(rotationStartedAt);
    if (!Number.isNaN(start.getTime())) {
      const elapsedDays = pakistanDayOrdinal(now) - pakistanDayOrdinal(start);
      if (elapsedDays <= 0) return 0;
      return elapsedDays % count;
    }
  }
  return fallbackWeekdayIndex(now) % count;
}

export function nextBigDealRotationIndex(rotationStartedAt?: string, now = new Date(), slotCount = SLOT_COUNT) {
  const count = normalizedSlotCount(slotCount);
  return (bigDealRotationIndex(rotationStartedAt, now, count) + 1) % count;
}

export const BIG_DEAL_SLOT_COUNT = SLOT_COUNT;
