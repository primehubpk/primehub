import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getDualSettings } from '@/lib/dualReadServer';
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { DailyDeal } from '@/lib/types';

export const runtime = 'nodejs';

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

function normalizeDeal(raw: any): DailyDeal {
  const imageUrls = Array.isArray(raw?.imageUrls)
    ? raw.imageUrls.map((value: unknown) => String(value || '').trim()).slice(0, 7)
    : [];
  const originalPrices = Array.isArray(raw?.originalPrices)
    ? raw.originalPrices.map((value: unknown) => Math.max(0, Number(value || 0))).slice(0, 7)
    : [];
  const dealPrices = Array.isArray(raw?.dealPrices)
    ? raw.dealPrices.map((value: unknown) => Math.max(0, Number(value || 0))).slice(0, 7)
    : [];

  return {
    productId: String(raw?.productId || '').trim(),
    imageUrl: String(raw?.imageUrl || imageUrls[0] || '').trim(),
    imageUrls,
    originalPrices,
    dealPrices,
    title: String(raw?.title || '').trim(),
    originalPrice: Math.max(0, Number(raw?.originalPrice || originalPrices[0] || 0)),
    dealPrice: Math.max(0, Number(raw?.dealPrice || dealPrices[0] || 0)),
    startAt: String(raw?.startAt || ''),
    endAt: String(raw?.endAt || ''),
    buttonText: String(raw?.buttonText || 'Shop Big Deal').trim() || 'Shop Big Deal',
    buttonLink: String(raw?.buttonLink || '/deals/big').trim() || '/deals/big',
    active: raw?.active === true,
  };
}

function validateDeal(deal: DailyDeal) {
  if (!deal.active) return '';
  if (!deal.title) return 'Big Deal title is required.';
  if (!deal.productId) return 'Big Deal product ID is required.';
  if ((deal.imageUrls || []).filter(Boolean).length !== 7) return 'All 7 Big Deal pictures are required.';
  const originals = deal.originalPrices || [];
  const specials = deal.dealPrices || [];
  for (let index = 0; index < 7; index += 1) {
    const regular = Number(originals[index] || 0);
    const special = Number(specials[index] || 0);
    if (regular <= 0 || special <= 0) return 'Each day needs an original price and deal price.';
    if (special >= regular) return 'Each daily deal price must be lower than its original price.';
  }
  return '';
}

async function writeSupabaseMain(payload: Record<string, any>) {
  const { url, key, configured } = supabaseWriteConfig();
  if (!configured) {
    return { ok: false, attempted: false, retryable: false, error: 'Supabase write credentials are not configured.' };
  }

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
        id: 'main',
        payload,
        authoritative_source: 'supabase',
        mirror_status: 'synced',
        mirror_error: null,
        updated_at: new Date().toISOString(),
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = `Supabase settings write failed ${response.status}.`;
      return { ok: false, attempted: true, retryable: response.status >= 500, error };
    }
    return { ok: true, attempted: true, retryable: false, error: '' };
  } catch (error) {
    return {
      ok: false,
      attempted: true,
      retryable: true,
      error: error instanceof Error ? error.message : 'Supabase settings write failed.',
    };
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const result = await getDualSettings();
  const dailyDeal = normalizeDeal(result.documents?.main?.dailyDeal || {});
  const hasPrimaryRotation = (dailyDeal.imageUrls || []).filter(Boolean).length === 7;
  if (hasPrimaryRotation) {
    return NextResponse.json({ success: true, source: result.source, dailyDeal });
  }

  // One-time compatibility fallback: older Big Deal icon saves may exist only
  // in Firestore because the previous mirror silently skipped Supabase. Prefer
  // that richer 7-day rotation only when Supabase does not have it yet.
  try {
    const snapshot = await getAdminDb().collection('settings').doc('main').get();
    if (snapshot.exists) {
      const firebaseDeal = normalizeDeal(snapshot.data()?.dailyDeal || {});
      if ((firebaseDeal.imageUrls || []).filter(Boolean).length === 7) {
        return NextResponse.json({ success: true, source: 'firebase-migration', dailyDeal: firebaseDeal });
      }
    }
  } catch (error) {
    console.warn('Big Deal legacy Firebase rotation lookup skipped', error);
  }

  return NextResponse.json({ success: true, source: result.source, dailyDeal });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const body = await request.json();
    const dailyDeal = normalizeDeal(body?.dailyDeal || {});
    const validationError = validateDeal(dailyDeal);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const current = await getDualSettings();
    const main = current.documents?.main && typeof current.documents.main === 'object' ? current.documents.main : {};
    const nextMain = { ...main, dailyDeal };
    const primary = await writeSupabaseMain(nextMain);

    if (primary.ok) {
      revalidateTag('storefront-settings');
      revalidateTag('salaar-store-knowledge');
      return NextResponse.json({ success: true, source: 'supabase' });
    }

    if (!primary.attempted || !primary.retryable) {
      console.error('Big Deal Supabase primary write blocked', primary.error);
      return NextResponse.json({ error: primary.error || 'Supabase Big Deal save is unavailable.' }, { status: 503 });
    }

    try {
      await getAdminDb().collection('settings').doc('main').set({ dailyDeal }, { merge: true });
      revalidateTag('storefront-settings');
      return NextResponse.json({
        success: true,
        source: 'firebase-fallback',
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
