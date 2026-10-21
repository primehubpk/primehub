import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { ensureMemberReferralCode, existingMemberReferralCode, readReferralSettings } from '@/lib/primeFamilyReferralsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function signedInUid(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/, '');
  if (!token || token.length > 5000) throw new Error('Sign in to your Prime Family account.');
  const decoded = await getAdminAuth().verifyIdToken(token, true);
  return decoded.uid;
}

export async function GET(request: Request) {
  try {
    const uid = await signedInUid(request);
    const [code, settings] = await Promise.all([existingMemberReferralCode(uid), readReferralSettings()]);
    return NextResponse.json({ code, referralEnabled: settings.enabled, percent: settings.percent }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Sign in to view your referral code.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  try {
    const uid = await signedInUid(request);
    const code = await ensureMemberReferralCode(uid);
    const settings = await readReferralSettings();
    return NextResponse.json({ code, referralEnabled: settings.enabled, percent: settings.percent }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to issue referral code.' }, { status: 400 });
  }
}
