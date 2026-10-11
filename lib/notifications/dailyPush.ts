// Pure selection logic; no database or network access.
import { bigDealConfiguredSlotCount, bigDealRotationIndex } from '@/lib/bigDealRotation';

export type PushSlot = 'browse' | 'big' | 'live' | 'arrivals';
export type PushContent = { title: string; body: string; path: string; imageUrl?: string };
export type PushInstall = { lastOpenedAt?: string; lastOrderAt?: string; lastProductId?: string; lastPath?: string };
type Product = Record<string, any>;
type Settings = Record<string, any>;
const ZONE = 'Asia/Karachi';
const ONE_DAY = 86_400_000;

export function pakistanDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function pakistanWeekday(now: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'long' }).format(now).toLowerCase();
}
function dayOrdinal(day: string): number { return Math.floor(Date.parse(day + 'T00:00:00Z') / ONE_DAY); }
function dayVersion(now: Date, slot: PushSlot, installId: string, variations: number) {
  // Varies each calendar day. Stable per slot/install on cron retries.
  const seed = [...(installId + slot)].reduce((n, c) => n + c.charCodeAt(0), 0);
  return ((dayOrdinal(pakistanDay(now)) + seed) % variations + variations) % variations;
}
function dateValue(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as any).toMillis === 'function') return (value as any).toMillis();
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}
function validProduct(p: Product | undefined): p is Product {
  return Boolean(p && p.id && p.published !== false && p.active !== false &&
    Number(p.price) > 0 && Number(p.stock ?? p.quantity ?? 1) > 0);
}
function title(p: Product) { return String(p.title || p.name || '').trim().slice(0, 85); }
function productPath(p: Product) { return '/product/' + encodeURIComponent(String(p.id)); }
function image(url: unknown): string | undefined {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'https:' && ['images.primehubmall.com', 'i.ibb.co', 'www.primehubmall.com'].includes(u.hostname)
      ? u.toString().slice(0, 900) : undefined;
  } catch { return undefined; }
}
function productImage(p: Product) {
  const first = Array.isArray(p.images) ? p.images[0] : '';
  return image(p.imageUrl || p.image || (typeof first === 'string' ? first : first?.url));
}
function money(value: number) { return 'Rs. ' + Math.round(value).toLocaleString('en-PK'); }
function withinRange(deal: any, now: Date) {
  const start = dateValue(deal?.startAt), end = dateValue(deal?.endAt);
  return (!start || now.getTime() >= start) && (!end || now.getTime() < end);
}
function firstMatching(p: Product[], id: unknown) { return p.find(v => String(v.id) === String(id || '')); }

export function selectDailyPush(slot: PushSlot, now: Date, installId: string, install: PushInstall, products: Product[], settings: Settings): PushContent | null {
  const eligible = products.filter(validProduct);
  if (!eligible.length) return null;
  const recentOpen = dateValue(install.lastOpenedAt);
  if (slot === 'browse') {
    // This slot is only for an actual app opener, not every installed device.
    if (!recentOpen || now.getTime() - recentOpen > 36 * 60 * 60_000 || recentOpen > now.getTime() + 60_000) return null;
    const order = dateValue(install.lastOrderAt);
    if (order && (order >= recentOpen || pakistanDay(new Date(order)) === pakistanDay(now))) return null;
    const viewed = firstMatching(eligible, install.lastProductId);
    const product = viewed || eligible[dayVersion(now, slot, installId, eligible.length)];
    if (!product || !title(product)) return null;
    const lowStock = Number(product.stock ?? product.quantity) > 0 && Number(product.stock ?? product.quantity) <= 5;
    const bodies = viewed
      ? ['Aapki pasand ka ' + title(product) + ' phir dekhein ✨',
         title(product) + ' abhi ' + money(Number(product.price)) + ' mein!',
         'Aapne ' + title(product) + ' dekha tha — ab phir dekhein 🛍️']
      : ['PrimeHub ki pick: ' + title(product) + ' 🛍️',
         title(product) + ' — aaj kuch naya dekhein!',
         'Aapke liye select kiya: ' + title(product)];
    const n = dayVersion(now, slot, installId, 3);
    return { title: (lowStock ? ['Sirf chand pieces!', 'Favourite alert!', 'PrimeHub pick!'][n]
      : ['Yeh aapke liye! ✨', 'PrimeHub ki aaj ki pick 🛍️', 'Kuch pasand aaya?'][n]),
      body: bodies[n], path: productPath(product) };
  }

  if (slot === 'big') {
    const d = settings.dailyDeal;
    if (!d || d.active !== true || !withinRange(d, now)) return null;
    const count = bigDealConfiguredSlotCount(d);
    const i = bigDealRotationIndex(d.rotationStartedAt, now, count);
    const id = d.productIds?.[i] || (i === 0 ? d.productId : '');
    const p = firstMatching(eligible, id);
    const price = Number(d.dealPrices?.[i] ?? (i === 0 ? d.dealPrice : 0));
    const regular = Number(d.originalPrices?.[i] ?? (i === 0 ? d.originalPrice : 0));
    if (!p || !title(p) || !(price > 0 && regular > price)) return null;
    const n = dayVersion(now, slot, installId, 3);
    const pic = image(d.imageUrls?.[i] || (i === 0 ? d.imageUrl : '')) || productImage(p);
    return { title: ['Aaj ka Big Deal! 🔥', 'Big Deal alert 🎉', 'PrimeHub Big Deal 🛍️'][n],
      body: [title(p) + ' sirf ' + money(price) + '!', money(regular) + ' se ' + money(price) + ' — ' + title(p),
        'Aaj ki special price ' + money(price) + ': ' + title(p)][n],
      path: '/deals/big', ...(pic ? { imageUrl: pic } : {}) };
  }

  if (slot === 'live') {
    const d = (Array.isArray(settings.weeklyDeals) ? settings.weeklyDeals : [])
      .find((deal: any) => deal?.active !== false && String(deal?.day).toLowerCase() === pakistanWeekday(now)
        && deal.productId);
    const p = firstMatching(eligible, d?.productId);
    const regular = Number(d?.originalPrice || p?.price || 0);
    const price = Number(d?.dealPrice || 0);
    if (!d || !p || !title(p) || !(price > 0 && price < regular)) return null;
    const n = dayVersion(now, slot, installId, 3);
    const pic = image(d.imageUrl) || productImage(p);
    return { title: ['Weekly Deal LIVE! 🔥', 'Aaj ki deal khul gayi!', 'Deal time on PrimeHub 🎉'][n],
      body: [title(p) + ' ' + money(price) + ' mein!', 'Aaj ' + title(p) + ' par special price ' + money(price),
        'Deal ab LIVE hai: ' + title(p)][n], path: '/weekly-deals', ...(pic ? { imageUrl: pic } : {}) };
  }

  // No artificial "new" labels for old catalogue items.
  const arrivals = eligible.filter(p => {
    const created = dateValue(p.createdAt || p.created_at);
    return created > 0 && now.getTime() - created >= 0 && now.getTime() - created <= 7 * ONE_DAY;
  }).sort((a, b) => dateValue(b.createdAt || b.created_at) - dateValue(a.createdAt || a.created_at));
  if (!arrivals.length) return null;
  const p = arrivals[dayVersion(now, slot, installId, Math.min(5, arrivals.length))];
  const n = dayVersion(now, slot, installId, 3);
  return { title: ['Fresh arrivals aa gaye! ✨', 'Naya stock, nayi pasand 🛍️', 'PrimeHub New Arrivals 🎉'][n],
    body: [title(p) + ' ab PrimeHub par!', 'Nayi collection mein ' + title(p) + ' dekhein',
      title(p) + ' aur naye designs explore karein'][n], path: '/new-arrivals' };
}
