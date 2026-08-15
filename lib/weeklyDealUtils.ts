import type { Weekday } from '@/lib/types';

export const WEEKDAY_ORDER: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};

export function pakistanParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi', weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  return {
    weekday: parts.find((p) => p.type === 'weekday')?.value.toLowerCase() as Weekday,
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
    day: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

export function pakistanNowWeekday(now = new Date()) {
  return pakistanParts(now).weekday;
}

export function pakistanMidnightForDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, -5, 0, 0));
}

export function nextUnlockAt(day: Weekday, now = new Date()) {
  const current = pakistanParts(now);
  const currentIndex = WEEKDAY_ORDER.indexOf(current.weekday);
  const targetIndex = WEEKDAY_ORDER.indexOf(day);
  const daysAhead = (targetIndex - currentIndex + 7) % 7 || 7;
  return pakistanMidnightForDate(current.year, current.month, current.day + daysAhead);
}

export function dealTiming(day: Weekday, now = new Date()) {
  const current = pakistanParts(now);
  const isLive = current.weekday === day;
  return { isLive, unlockAt: isLive ? pakistanMidnightForDate(current.year, current.month, current.day + 1) : nextUnlockAt(day, now) };
}

export function countdownParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
