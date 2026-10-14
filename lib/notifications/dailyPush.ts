// Pure selection logic; no database or network access.
import { bigDealConfiguredSlotCount, bigDealRotationIndex } from '@/lib/bigDealRotation';

export type PushSlot = 'browse' | 'big' | 'live' | 'arrivals';
export type PushContent = { title: string; body: string; path: string; imageUrl?: string };
export type PushInstall = { lastOpenedAt?: string; lastOrderAt?: string; lastProductId?: string; lastPath?: string; displayName?: string };
type Product = Record<string, any>;
type Settings = Record<string, any>;
const ZONE = 'Asia/Karachi';
const ONE_DAY = 86_400_000;
const eligibilityCache = new WeakMap<Product[], Product[]>();

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
  const variant = Array.isArray(p.variantMatrix) ? p.variantMatrix.find((v: any) => v?.imageUrl) : undefined;
  return image(p.imageUrl) || image(p.image) ||
    image(typeof first === 'string' ? first : first?.url || first?.imageUrl) ||
    image(variant?.imageUrl);
}
function userFirstName(install: PushInstall) {
  const value = String(install.displayName || '').trim().split(/\s+/)[0] || '';
  return value.length >= 2 && value.length <= 24 && /^[\p{L}\p{M}'-]+$/u.test(value) ? value : '';
}
function personalized(install: PushInstall, value: string) {
  const first = userFirstName(install);
  return first ? first + ', ' + value : value;
}
function dealEndsToday(now: Date, explicitEnd?: unknown, weeklyDayEndsAtMidnight = false) {
  // Big Deal uses an explicit end timestamp. Never invent a midnight end.
  // Weekly Deals really rotate at Karachi midnight (weeklyDealUtils.ts).
  const end = dateValue(explicitEnd) ||
    (weeklyDayEndsAtMidnight ? Date.parse(pakistanDay(now) + 'T23:59:59+05:00') : 0);
  if (!end) return 0;
  const hours = (end - now.getTime()) / 3_600_000;
  return hours > 0 && hours <= 4 ? Math.max(1, Math.ceil(hours)) : 0;
}
function money(value: number) { return 'Rs. ' + Math.round(value).toLocaleString('en-PK'); }
function withinRange(deal: any, now: Date) {
  const start = dateValue(deal?.startAt), end = dateValue(deal?.endAt);
  return (!start || now.getTime() >= start) && (!end || now.getTime() < end);
}
function firstMatching(p: Product[], id: unknown) { return p.find(v => String(v.id) === String(id || '')); }

export function selectDailyPush(slot: PushSlot, now: Date, installId: string, install: PushInstall, products: Product[], settings: Settings): PushContent | null {
  let eligible = eligibilityCache.get(products);
  if (!eligible) { eligible = products.filter(validProduct); eligibilityCache.set(products, eligible); }
  if (!eligible.length) return null;
  const recentOpen = dateValue(install.lastOpenedAt);
  if (slot === 'browse') {
    // This slot is only for an actual app opener, not every installed device.
    if (!recentOpen || now.getTime() - recentOpen > 36 * 60 * 60_000 || recentOpen > now.getTime() + 60_000) return null;
    const order = dateValue(install.lastOrderAt);
    if (order && (order >= recentOpen || pakistanDay(new Date(order)) === pakistanDay(now))) return null;
    // Always attach a real product image, never text-only browse recommendations.
    const withPhotos = eligible.filter(p => Boolean(productImage(p)));
    if (!withPhotos.length) return null;
    const viewed = firstMatching(withPhotos, install.lastProductId);
    const product = viewed || withPhotos[dayVersion(now, slot, installId, withPhotos.length)];
    if (!product || !title(product)) return null;
    const lowStock = Number(product.stock ?? product.quantity) > 0 && Number(product.stock ?? product.quantity) <= 5;
    const n = dayVersion(now, slot, installId, 4);
    const headlines = viewed
      ? ['Aapki pasand phir dekhein ✨', 'Pasandida design miss na ho!', 'Aapka design yaad hai 🛍️', 'Ab bhi pasand hai?']
      : ['Aaj ki PrimeHub pick 🎁', 'New styles, fresh vibes ✨', 'Aapke liye ek khaas pick!', 'Bangles ka naya style 💫'];
    const message = viewed
      ? title(product) + ' sirf ' + money(Number(product.price)) + ' mein. Apni pasand phir dekhein!'
      : title(product) + ' ' + money(Number(product.price)) + ' mein. Design photo dekhein!';
    return { title: personalized(install, lowStock ? 'Sirf kuch pieces baqi! ⏳' : headlines[n]),
      body: message, path: productPath(product), imageUrl: productImage(product) };
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
    if (!pic) return null;
    const ends = dealEndsToday(now, d.endAt);
    const saved = Math.round(regular - price);
    const copy = [
      'Big Deal LIVE — ' + money(saved) + ' bachayein! 🔥',
      'Price drop: ' + money(regular) + ' → ' + money(price) + '!',
      'Big Deal miss mat karna! ✨',
    ];
    return {
      title: personalized(install, ends ? 'Big Deal khatam hone wali hai! ⏳' : copy[n]),
      body: title(p) + ' ab ' + money(price) + ' mein. ' +
        (ends ? 'Sirf ' + ends + ' ghantay baqi — abhi dekhein!' : 'Offer live hai — asli product ki photo dekhein!'),
      path: '/deals/big', imageUrl: pic,
    };
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
    if (!pic) return null;
    const hours = dealEndsToday(now, d.endAt, true);
    const saved = Math.round(regular - price);
    return {
      title: personalized(install, hours
        ? ['Weekly Deal — sirf kuch ghantay baqi! ⏳', 'Last chance: aaj ki deal khatam! 🔥', 'Deal end ho rahi hai, jaldi dekhein!'][n]
        : ['Weekly Deal LIVE! 🔥', 'Aaj ki deal khul gayi! 🛍️', 'Special Deal — save ' + money(saved) + '!'][n]),
      body: title(p) + ': ' + money(regular) + ' se ' + money(price) + '!' +
        (hours ? ' Sirf ' + hours + ' ghantay baqi, abhi order karein.' : ' Original photo aur designs abhi dekhein.'),
      path: '/weekly-deals', imageUrl: pic,
    };
  }

  // No artificial "new" labels for old catalogue items.
  const arrivals = eligible.filter(p => {
    const created = dateValue(p.createdAt || p.created_at);
    return created > 0 && now.getTime() - created >= 0 && now.getTime() - created <= 7 * ONE_DAY && Boolean(productImage(p));
  }).sort((a, b) => dateValue(b.createdAt || b.created_at) - dateValue(a.createdAt || a.created_at));
  if (!arrivals.length) return null;
  const p = arrivals[dayVersion(now, slot, installId, Math.min(5, arrivals.length))];
  const n = dayVersion(now, slot, installId, 3);
  return {
    title: personalized(install, ['Naye designs aa gaye! ✨', 'Fresh stock — aaj hi dekhein 🎁', 'New Arrivals ki first look 👀'][n]),
    body: title(p) + ' ' + money(Number(p.price)) + ' mein — nayi collection ki photo dekhein!',
    path: '/new-arrivals', imageUrl: productImage(p),
  };
}
