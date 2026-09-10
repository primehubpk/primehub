import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const snapshot = await getAdminDb().collection('settings').doc('main').get();
    if (snapshot.exists && snapshot.data()?.salar_public_enabled === true) {
      await getAdminDb().collection('settings').doc('main').set({ salar_public_enabled: false, salar_public_updated_at: new Date().toISOString() }, { merge: true });
      revalidateTag('storefront-settings');
    }
    return NextResponse.json({ salar_public_enabled: false, locked_for_admin_testing: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Salar setting.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    if (body?.salar_public_enabled === true) return NextResponse.json({ error: 'Salar public ON is locked during admin testing. Human merge/release approval is required first.' }, { status: 409 });
    await getAdminDb().collection('settings').doc('main').set({ salar_public_enabled: false, salar_public_updated_at: new Date().toISOString() }, { merge: true });
    revalidateTag('storefront-settings');
    return NextResponse.json({ ok: true, salar_public_enabled: false, locked_for_admin_testing: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to save Salar setting.' }, { status: 500 });
  }
}
