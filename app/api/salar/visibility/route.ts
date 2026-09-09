import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminLoggedIn = isExistingPrimeHubAdminRequest(request);
  let publicEnabled = false;
  try {
    const snapshot = await getAdminDb().collection('settings').doc('main').get();
    publicEnabled = snapshot.exists && snapshot.data()?.salar_public_enabled === true;
  } catch {
    publicEnabled = false;
  }

  return NextResponse.json({
    visible: adminLoggedIn || publicEnabled,
    adminLoggedIn,
    salar_public_enabled: publicEnabled,
  }, { headers: { 'Cache-Control': 'no-store, private' } });
}
