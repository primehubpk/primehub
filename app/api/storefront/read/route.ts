import { NextResponse } from 'next/server';
import {
  getConfiguredReadMode,
  getDualCatalog,
  getDualProduct,
  getDualSettings,
  getDualSkills,
} from '@/lib/dualReadServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = String(url.searchParams.get('type') || 'catalog');
  try {
    if (type === 'settings') {
      const result = await getDualSettings();
      return NextResponse.json({ ...result, mode: getConfiguredReadMode() }, { headers: { 'Cache-Control': 'private, max-age=30' } });
    }
    if (type === 'skills') {
      const result = await getDualSkills();
      return NextResponse.json({ ...result, mode: getConfiguredReadMode() }, { headers: { 'Cache-Control': 'private, max-age=60' } });
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
