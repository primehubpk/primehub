const SLOT_COUNT = 7;
const DAY_MS = 86_400_000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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

export function bigDealRotationIndex(rotationStartedAt?: string, now = new Date()) {
  if (rotationStartedAt) {
    const start = new Date(rotationStartedAt);
    if (!Number.isNaN(start.getTime())) {
      const elapsedDays = pakistanDayOrdinal(now) - pakistanDayOrdinal(start);
      if (elapsedDays <= 0) return 0;
      return elapsedDays % SLOT_COUNT;
    }
  }
  return fallbackWeekdayIndex(now);
}

export function nextBigDealRotationIndex(rotationStartedAt?: string, now = new Date()) {
  return (bigDealRotationIndex(rotationStartedAt, now) + 1) % SLOT_COUNT;
}

export const BIG_DEAL_SLOT_COUNT = SLOT_COUNT;
