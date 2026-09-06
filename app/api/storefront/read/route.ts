import { NextResponse } from 'next/server';
import { getDualCatalog, getDualSettings, getDualSkills, getConfiguredReadMode } from '@/lib/dualReadServer';

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
    const result = await getDualCatalog();
    return NextResponse.json({ ...result, mode: getConfiguredReadMode() }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    console.error('storefront dual read failed', error);
    return NextResponse.json({ error: 'Storefront data unavailable.' }, { status: 503 });
  }
}
