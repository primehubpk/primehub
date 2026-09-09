import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isExistingPrimeHubAdminRequest(request)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const snapshot = await getAdminDb().collection('settings').doc('main').get();
    const enabled = snapshot.exists && snapshot.data()?.salar_public_enabled === true;
    return NextResponse.json({ salar_public_enabled: enabled }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Salar setting.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isExistingPrimeHubAdminRequest(request)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    if (typeof body?.salar_public_enabled !== 'boolean') {
      return NextResponse.json({ error: 'salar_public_enabled must be boolean.' }, { status: 400 });
    }
    await getAdminDb().collection('settings').doc('main').set({
      salar_public_enabled: body.salar_public_enabled,
      salar_public_updated_at: new Date().toISOString(),
    }, { merge: true });
    revalidateTag('storefront-settings');
    return NextResponse.json({ ok: true, salar_public_enabled: body.salar_public_enabled }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to save Salar setting.' }, { status: 500 });
  }
}
