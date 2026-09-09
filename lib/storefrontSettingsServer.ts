import 'server-only';
import { unstable_cache } from 'next/cache';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getDualSettings, type DualReadCacheOptions } from '@/lib/dualReadServer';

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

function dedicatedDeal(main: any) {
  return main?.bigDeal && typeof main.bigDeal === 'object' ? main.bigDeal : null;
}

function legacyManagerRotation(main: any) {
  const legacy = main?.dailyDeal && typeof main.dailyDeal === 'object' ? main.dailyDeal : null;
  return legacy && completeBigDealSlotCount(legacy) >= SLOT_COUNT ? legacy : null;
}

function withStorefrontBigDeal(result: Awaited<ReturnType<typeof getDualSettings>>, deal: any) {
  const main = result.documents?.main && typeof result.documents.main === 'object'
    ? result.documents.main
    : {};
  return {
    ...result,
    documents: {
      ...result.documents,
      main: {
        ...main,
        dailyDeal: deal || null,
      },
    },
  };
}

const getFirebaseBigDealCandidates = unstable_cache(
  async () => {
    const snapshot = await getAdminDb().collection('settings').doc('main').get();
    if (!snapshot.exists) return { dedicated: null, legacyRotation: null };
    const data = serial(snapshot.data() || {});
    return {
      dedicated: dedicatedDeal(data),
      legacyRotation: legacyManagerRotation(data),
    };
  },
  ['primehub-storefront-big-deal-dedicated-recovery-v1'],
  { revalidate: 60, tags: ['storefront-settings'] },
);

export async function getStorefrontSettingsWithBigDealRecovery(cacheOptions?: DualReadCacheOptions) {
  const result = await getDualSettings(cacheOptions);
  const main = result.documents?.main && typeof result.documents.main === 'object'
    ? result.documents.main
    : {};

  const primaryDedicated = dedicatedDeal(main);
  if (primaryDedicated) return withStorefrontBigDeal(result, primaryDedicated);

  if (result.source === 'supabase') {
    try {
      const firebase = await getFirebaseBigDealCandidates();
      if (firebase.dedicated) {
        console.warn('PrimeHub Big Deal storefront recovered the dedicated Firebase copy while Supabase catches up.');
        return withStorefrontBigDeal(result, firebase.dedicated);
      }
    } catch (error) {
      console.warn('PrimeHub dedicated Big Deal Firebase recovery lookup skipped', error);
    }
  }

  const primaryLegacyRotation = legacyManagerRotation(main);
  if (primaryLegacyRotation) return withStorefrontBigDeal(result, primaryLegacyRotation);

  if (result.source === 'supabase') {
    try {
      const firebase = await getFirebaseBigDealCandidates();
      if (firebase.legacyRotation) {
        console.warn('PrimeHub Big Deal storefront recovered a legacy 7-slot manager rotation for migration.');
        return withStorefrontBigDeal(result, firebase.legacyRotation);
      }
    } catch (error) {
      console.warn('PrimeHub legacy Big Deal migration lookup skipped', error);
    }
  }

  return withStorefrontBigDeal(result, null);
}
