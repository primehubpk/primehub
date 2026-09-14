import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function approvedPublicPreview() {
  return process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'feature/salar';
}

export async function GET(request: Request) {
  const adminLoggedIn = isExistingPrimeHubAdminRequest(request);
  const previewEnabled = approvedPublicPreview();
  let settingEnabled = false;
  try {
    const snapshot = await getAdminDb().collection('settings').doc('main').get();
    settingEnabled = snapshot.exists && snapshot.data()?.salar_public_enabled === true;
  } catch (error) {
    console.warn('[salar-visibility] setting read failed', { error: error instanceof Error ? error.message : 'unknown' });
  }
  const publicEnabled = previewEnabled || settingEnabled;
  return NextResponse.json({
    visible: adminLoggedIn || publicEnabled,
    adminLoggedIn,
    salar_public_enabled: publicEnabled,
    preview_enabled: previewEnabled,
  }, { headers: { 'Cache-Control': 'no-store, private' } });
}
