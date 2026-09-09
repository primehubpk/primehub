import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { getDualCatalog, getDualSettings } from '@/lib/dualReadServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { DailyDeal } from '@/lib/types';

export const runtime = 'nodejs';
const SLOT_COUNT = 7;

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function supabaseWriteConfig() {
  const url = envValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const key = envValue('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY');
  return { url, key, configured: Boolean(url && key) };
}

function cleanStrings(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).slice(0, SLOT_COUNT) : [];
}

function cleanNumbers(value: unknown) {
  return Array.isArray(value) ? value.map((item) => Math.max(0, Number(item || 0))).slice(0, SLOT_COUNT) : [];
}

function normalizeDeal(raw: any): DailyDeal {
  const imageUrls = cleanStrings(raw?.imageUrls);
  const productIdsRaw = cleanStrings(raw?.productIds);
  const titlesRaw = cleanStrings(raw?.titles);
  const categoryIds = cleanStrings(raw?.categoryIds);
  const originalPricesRaw = cleanNumbers(raw?.originalPrices);
  const dealPricesRaw = cleanNumbers(raw?.dealPrices);
  const legacyLength = Math.min(
    SLOT_COUNT,
    Math.max(
      imageUrls.filter(Boolean).length,
      originalPricesRaw.filter((value) => value > 0).length,
      dealPricesRaw.filter((value) => value > 0).length,
      raw?.imageUrl || raw?.productId || raw?.title ? 1 : 0,
    ),
  );
  const productIds = Array.from({ length: SLOT_COUNT }, (_, index) =>
    productIdsRaw[index] || (index < legacyLength ? String(raw?.productId || '').trim() : ''),
  );
  const titles = Array.from({ length: SLOT_COUNT }, (_, index) =>
    titlesRaw[index] || (index < legacyLength ? String(raw?.title || '').trim() : ''),
  );
  const images = Array.from({ length: SLOT_COUNT }, (_, index) =>
    imageUrls[index] || (index === 0 ? String(raw?.imageUrl || '').trim() : ''),
  );
  const originalPrices = Array.from({ length: SLOT_COUNT }, (_, index) =>
    originalPricesRaw[index] || (index < legacyLength ? Math.max(0, Number(raw?.originalPrice || 0)) : 0),
  );
  const dealPrices = Array.from({ length: SLOT_COUNT }, (_, index) =>
    dealPricesRaw[index] || (index < legacyLength ? Math.max(0, Number(raw?.dealPrice || 0)) : 0),
  );

  return {
    productId: productIds[0] || String(raw?.productId || '').trim(),
    productIds,
    title: titles[0] || String(raw?.title || '').trim(),
    titles,
    categoryIds: Array.from({ length: SLOT_COUNT }, (_, index) => categoryIds[index] || ''),
    imageUrl: images[0] || String(raw?.imageUrl || '').trim(),
    imageUrls: images,
    originalPrices,
    dealPrices,
    originalPrice: originalPrices[0] || Math.max(0, Number(raw?.originalPrice || 0)),
    dealPrice: dealPrices[0] || Math.max(0, Number(raw?.dealPrice || 0)),
    rotationStartedAt: String(raw?.rotationStartedAt || '').trim(),
    startAt: String(raw?.startAt || ''),
    endAt: String(raw?.endAt || ''),
    buttonText: String(raw?.buttonText || 'Shop Big Deal').trim() || 'Shop Big Deal',
    buttonLink: String(raw?.buttonLink || '/deals/big').trim() || '/deals/big',
    active: raw?.active === true,
  };
}

function hasRawDeal(raw: any) {
  return Boolean(raw && typeof raw === 'object' && Object.keys(raw).length > 0);
}

function slotHasAny(deal: DailyDeal, index: number) {
  return Boolean(
    deal.imageUrls?.[index] || deal.productIds?.[index] || deal.titles?.[index] ||
    Number(deal.originalPrices?.[index] || 0) > 0 || Number(deal.dealPrices?.[index] || 0) > 0,
  );
}

function slotComplete(deal: DailyDeal, index: number) {
  const regular = Number(deal.originalPrices?.[index] || 0);
  const special = Number(deal.dealPrices?.[index] || 0);
  return Boolean(
    deal.imageUrls?.[index] && deal.productIds?.[index] && deal.titles?.[index] &&
    regular > 0 && special > 0 && special < regular,
  );
}

function completeSlotCount(deal: DailyDeal) {
  return Array.from({ length: SLOT_COUNT }, (_, index) => slotComplete(deal, index)).filter(Boolean).length;
}

function validateDeal(deal: DailyDeal) {
  for (let index = 0; index < SLOT_COUNT; index += 1) {
    if (slotHasAny(deal, index) && !slotComplete(deal, index)) {
      return `Deal ${index + 1} needs an image, product, original price and a lower Big Deal price.`;
    }
  }
  if (deal.active && completeSlotCount(deal) !== SLOT_COUNT) {
    return 'All 7 Big Deals must be complete before publishing the cycle.';
  }
  return '';
}

function productImage(product: any) {
  if (typeof product?.imageUrl === 'string' && product.imageUrl) return product.imageUrl;
  if (typeof product?.image === 'string' && product.image) return product.image;
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  return typeof first === 'string' ? first : String(first?.url || '');
}

function compactProduct(product: any) {
  return {
    id: String(product?.id || ''),
    title: String(product?.title || product?.name || ''),
    name: String(product?.name || product?.title || ''),
    imageUrl: productImage(product),
    price: Number(product?.price || 0),
    originalPrice: Number(product?.originalPrice || product?.normalPrice || product?.price || 0),
    normalPrice: Number(product?.normalPrice || product?.originalPrice || product?.price || 0),
    categoryId: String(product?.categoryId || ''),
    category: String(product?.category || ''),
    active: product?.active !== false,
    published: product?.published !== false,
  };
}

function compactCategory(category: any) {
  return {
    id: String(category?.id || ''),
    title: String(category?.title || category?.name || category?.slug || category?.id || ''),
    name: String(category?.name || category?.title || ''),
    slug: String(category?.slug || ''),
    active: category?.active !== false,
  };
}

async function writeSupabaseMain(payload: Record<string, any>) {
  const { url, key, configured } = supabaseWriteConfig();
  if (!configured) return { ok: false, attempted: false, retryable: false, error: 'Supabase write credentials are not configured.' };
  try {
    const response = await fetch(`${url}/rest/v1/settings?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: 'main', payload, authoritative_source: 'supabase', mirror_status: 'synced', mirror_error: null,
        updated_at: new Date().toISOString(),
      }),
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false, attempted: true, retryable: response.status >= 500, error: `Supabase settings write failed ${response.status}.` };
    return { ok: true, attempted: true, retryable: false, error: '' };
  } catch (error) {
    return { ok: false, attempted: true, retryable: true, error: error instanceof Error ? error.message : 'Supabase settings write failed.' };
  }
}

async function firebaseBigDealCandidate() {
  const snapshot = await getAdminDb().collection('settings').doc('main').get();
  if (!snapshot.exists) return { dedicated: null as any, legacy: null as any };
  const data = snapshot.data() || {};
  return {
    dedicated: hasRawDeal(data.bigDeal) ? data.bigDeal : null,
    legacy: hasRawDeal(data.dailyDeal) ? data.dailyDeal : null,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const [settingsResult, catalogResult] = await Promise.all([getDualSettings(), getDualCatalog()]);
  const main = settingsResult.documents?.main && typeof settingsResult.documents.main === 'object'
    ? settingsResult.documents.main
    : {};

  let rawDeal = hasRawDeal(main.bigDeal) ? main.bigDeal : null;
  let source: typeof settingsResult.source | 'firebase-migration' = settingsResult.source;
  let migratedFromLegacy = false;

  if (!rawDeal) {
    try {
      const firebase = await firebaseBigDealCandidate();
      if (firebase.dedicated) {
        rawDeal = firebase.dedicated;
        source = 'firebase-migration';
      }
    } catch (error) {
      console.warn('Big Deal dedicated Firebase lookup skipped', error);
    }
  }

  if (!rawDeal && hasRawDeal(main.dailyDeal)) {
    rawDeal = main.dailyDeal;
    migratedFromLegacy = true;
  }

  if (!rawDeal) {
    try {
      const firebase = await firebaseBigDealCandidate();
      if (firebase.legacy) {
        rawDeal = firebase.legacy;
        source = 'firebase-migration';
        migratedFromLegacy = true;
      }
    } catch (error) {
      console.warn('Big Deal legacy Firebase lookup skipped', error);
    }
  }

  const dailyDeal = normalizeDeal(rawDeal || {});

  return NextResponse.json({
    success: true,
    source,
    catalogSource: catalogResult.source,
    migratedFromLegacy,
    dailyDeal,
    products: catalogResult.products.map(compactProduct).filter((product) => product.id),
    categories: catalogResult.categories.map(compactCategory).filter((category) => category.id),
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const body = await request.json();
    let dailyDeal = normalizeDeal(body?.dailyDeal || {});
    const validationError = validateDeal(dailyDeal);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const current = await getDualSettings();
    const main = current.documents?.main && typeof current.documents.main === 'object' ? current.documents.main : {};
    const existing = normalizeDeal(main.bigDeal || main.dailyDeal || {});
    if (dailyDeal.active && !dailyDeal.rotationStartedAt) {
      dailyDeal = {
        ...dailyDeal,
        rotationStartedAt: existing.active && existing.rotationStartedAt ? existing.rotationStartedAt : new Date().toISOString(),
      };
    }

    // The dedicated Big Deal icon owns `bigDeal`. Legacy Store Settings `dailyDeal`
    // is removed from the primary payload whenever the dedicated manager saves.
    const { dailyDeal: _legacyStoreSettingsDeal, ...mainWithoutLegacyDeal } = main;
    const nextMain = { ...mainWithoutLegacyDeal, bigDeal: dailyDeal };
    const primary = await writeSupabaseMain(nextMain);

    if (primary.ok) {
      let warning = '';
      try {
        await getAdminDb().collection('settings').doc('main').set(
          { bigDeal: dailyDeal, dailyDeal: FieldValue.delete() },
          { merge: true },
        );
      } catch (mirrorError) {
        console.warn('Big Deal Firebase fallback mirror skipped', mirrorError);
        warning = 'Big Deal saved to Supabase primary. Firebase fallback mirror could not be refreshed.';
      }
      revalidateTag('storefront-settings');
      revalidateTag('salaar-store-knowledge');
      return NextResponse.json({ success: true, source: 'supabase', dailyDeal, warning });
    }

    if (!primary.attempted || !primary.retryable) {
      console.error('Big Deal Supabase primary write blocked', primary.error);
      return NextResponse.json({ error: primary.error || 'Supabase Big Deal save is unavailable.' }, { status: 503 });
    }

    try {
      await getAdminDb().collection('settings').doc('main').set(
        { bigDeal: dailyDeal, dailyDeal: FieldValue.delete() },
        { merge: true },
      );
      revalidateTag('storefront-settings');
      return NextResponse.json({
        success: true,
        source: 'firebase-fallback',
        dailyDeal,
        warning: 'Supabase was temporarily unavailable, so the Big Deal was saved to Firebase fallback only.',
      });
    } catch (fallbackError) {
      console.error('Big Deal fallback write failed', fallbackError);
      return NextResponse.json({ error: 'Big Deal could not be saved to Supabase or Firebase fallback.' }, { status: 503 });
    }
  } catch (error) {
    console.error('Big Deal admin route failed', error);
    return NextResponse.json({ error: 'Big Deal save failed.' }, { status: 500 });
  }
}
