import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';
import { readReferralSettings, saveReferralSettings } from '@/lib/primeFamilyReferralsServer';
import { bonusIsEnabled, PLAY_INSTALL_BONUS_RUPEES } from '@/lib/playInstallBonus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!authorizedWalletAdmin(request)) return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  try {
    const db = getAdminDb();
    const requestedCode = (new URL(request.url)).searchParams.get('code')?.trim().toUpperCase() || '';
    if (requestedCode && !/^PRIMEFAMILY[1-9][0-9]{0,6}$/.test(requestedCode)) {
      return NextResponse.json({ error: 'Enter a valid numbered Prime Family code.' }, { status: 400 });
    }
    const [settings, codes, credits] = await Promise.all([
      readReferralSettings(),
      requestedCode
        ? db.collection('reseller_referral_codes').doc(requestedCode).get()
        : db.collection('reseller_referral_codes').orderBy('sequence', 'desc').limit(75).get(),
      db.collection('reseller_referral_credits').orderBy('createdAt', 'desc').limit(75).get(),
    ]);
    const shownCodes = ('docs' in codes)
      ? codes.docs
      : codes.exists ? [codes] : [];
    return NextResponse.json({
      settings,
      welcomeBonus: { enabled: bonusIsEnabled(), rupees: PLAY_INSTALL_BONUS_RUPEES, note: 'Google Play native-app installation and verified login only; one per account/device. Shopping-only credit; no withdrawal for new rewards.' },
      codes: shownCodes.map(d => ({
        code: String(d.data()?.code || ''),
        ownerEmail: String(d.data()?.ownerEmail || ''),
        ownerUid: String(d.data()?.ownerUid || ''),
        createdAt: d.createTime?.toDate().toISOString() || '',
      })),
      credits: credits.docs.map(d => ({
        orderId: String(d.data()?.orderId || ''),
        code: String(d.data()?.code || ''),
        amount: Number(d.data()?.amount || 0),
        percent: Number(d.data()?.percent || 0),
        ownerUid: String(d.data()?.ownerUid || ''),
        buyerUid: String(d.data()?.buyerUid || ''),
        createdAt: d.createTime?.toDate().toISOString() || '',
      })),
      truncated: { codes: 'size' in codes && codes.size === 75, credits: credits.size === 75 },
      codeSearch: requestedCode,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Referral reporting temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authorizedWalletAdmin(request)) return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const body = await request.json();
    const settings = await saveReferralSettings(body?.settings);
    return NextResponse.json({ success: true, settings }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid referral settings.' }, { status: 400 });
  }
}
