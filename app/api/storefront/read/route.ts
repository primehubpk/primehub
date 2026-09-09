import { NextResponse } from 'next/server';
import {
  getConfiguredReadMode,
  getDualCatalog,
  getDualProduct,
  getDualSkills,
} from '@/lib/dualReadServer';
import { getStorefrontSettingsWithBigDealRecovery } from '@/lib/storefrontSettingsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requestedProductIds(url: URL) {
  try {
    const parsed = JSON.parse(String(url.searchParams.get('ids') || '[]'));
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    ).slice(0, 24);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = String(url.searchParams.get('type') || 'catalog');
  try {
    if (type === 'settings') {
      const result = await getStorefrontSettingsWithBigDealRecovery();
      return NextResponse.json({ ...result, mode: getConfiguredReadMode() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }
    if (type === 'skills') {
      const result = await getDualSkills();
      return NextResponse.json({ ...result, mode: getConfiguredReadMode() }, { headers: { 'Cache-Control': 'private, max-age=60' } });
    }
    if (type === 'products') {
      const ids = requestedProductIds(url);
      if (ids.length === 0) {
        return NextResponse.json({ error: 'At least one product id is required.' }, { status: 400 });
      }
      const results = await Promise.all(ids.map((id) => getDualProduct(id)));
      const products = results
        .map((result) => result.product)
        .filter((product) => Boolean(product));
      return NextResponse.json(
        { products, mode: getConfiguredReadMode() },
        { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } },
      );
    }
    if (type === 'product') {
      const id = String(url.searchParams.get('id') || '').trim();
      if (!id) {
        return NextResponse.json({ error: 'Product id is required.' }, { status: 400 });
      }
      const result = await getDualProduct(id);
      if (!result.product) {
        return NextResponse.json({ error: 'Product not found.', mode: getConfiguredReadMode() }, { status: 404 });
      }
      return NextResponse.json({ ...result, mode: getConfiguredReadMode() }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } });
    }
    const result = await getDualCatalog();
    return NextResponse.json({ ...result, mode: getConfiguredReadMode() }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    console.error('storefront dual read failed', error);
    return NextResponse.json({ error: 'Storefront data unavailable.' }, { status: 503 });
  }
}
