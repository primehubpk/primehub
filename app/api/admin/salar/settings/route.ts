import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function approvedPublicPreview() {
  return process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'feature/salar';
}

export async function GET(request: Request) {
  if (!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const snapshot = await getAdminDb().collection('settings').doc('main').get();
    const settingEnabled = snapshot.exists && snapshot.data()?.salar_public_enabled === true;
    const previewEnabled = approvedPublicPreview();
    return NextResponse.json({
      salar_public_enabled: previewEnabled || settingEnabled,
      preview_enabled: previewEnabled,
      setting_enabled: settingEnabled,
      locked_for_admin_testing: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[salar-settings] read failed', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Unable to load Salar setting.' }, { status: 500 });
  }
}
