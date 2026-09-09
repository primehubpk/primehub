import 'server-only';
import { unstable_cache } from 'next/cache';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getDualSettings } from '@/lib/dualReadServer';

const SLOT_COUNT = 7;

function serial(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(serial);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try { return value.toDate().toISOString(); } catch { return null; }
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serial(item)]));
  }
  return value;
}

function completeBigDealSlotCount(raw: any) {
  const images = Array.isArray(raw?.imageUrls) ? raw.imageUrls : [];
  const productIds = Array.isArray(raw?.productIds) ? raw.productIds : [];
  const titles = Array.isArray(raw?.titles) ? raw.titles : [];
  const originalPrices = Array.isArray(raw?.originalPrices) ? raw.originalPrices : [];
  const dealPrices = Array.isArray(raw?.dealPrices) ? raw.dealPrices : [];

  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    const originalPrice = Number(originalPrices[index] || 0);
    const dealPrice = Number(dealPrices[index] || 0);
    return Boolean(
      String(images[index] || '').trim() &&
      String(productIds[index] || '').trim() &&
      String(titles[index] || '').trim() &&
      originalPrice > 0 &&
      dealPrice > 0 &&
      dealPrice < originalPrice,
    );
  }).filter(Boolean).length;
}

const getFirebasePublishedBigDeal = unstable_cache(
  async () => {
    const snapshot = await getAdminDb().collection('settings').doc('main').get();
    if (!snapshot.exists) return null;
    const deal = serial(snapshot.data()?.dailyDeal || null);
    return deal && typeof deal === 'object' ? deal : null;
  },
  ['primehub-storefront-big-deal-firebase-recovery-v1'],
  { revalidate: 60, tags: ['storefront-settings'] },
);

export async function getStorefrontSettingsWithBigDealRecovery() {
  const result = await getDualSettings();
  if (result.source !== 'supabase') return result;

  const main = result.documents?.main && typeof result.documents.main === 'object'
    ? result.documents.main
    : {};
  const primaryDeal = main.dailyDeal && typeof main.dailyDeal === 'object'
    ? main.dailyDeal
    : {};
  const primaryCompleteSlots = completeBigDealSlotCount(primaryDeal);

  if (primaryCompleteSlots >= SLOT_COUNT) return result;

  try {
    const firebaseDeal = await getFirebasePublishedBigDeal();
    if (!firebaseDeal || firebaseDeal.active !== true) return result;

    const firebaseCompleteSlots = completeBigDealSlotCount(firebaseDeal);
    if (firebaseCompleteSlots <= primaryCompleteSlots) return result;

    console.warn('PrimeHub Big Deal storefront recovered the published Firebase rotation while Supabase settings catch up.');
    return {
      ...result,
      documents: {
        ...result.documents,
        main: {
          ...main,
          dailyDeal: firebaseDeal,
        },
      },
    };
  } catch (error) {
    console.warn('PrimeHub Big Deal Firebase recovery lookup skipped', error);
    return result;
  }
}
