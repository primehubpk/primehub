import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { bonusChallenge, bonusIsEnabled, claimPlayInstallBonus, PLAY_INSTALL_BONUS_RUPEES } from '@/lib/playInstallBonus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Intended for the genuine native Android app, not the browser. Backend verifies
// each Google-signed attestation with Google Play before awarding any cash.
export async function POST(request: Request) {
  const noStore = { 'Cache-Control': 'private, no-store' };
  if (!bonusIsEnabled()) {
    return NextResponse.json({ error: 'Play Store reward is not enabled yet.' }, { status: 503, headers: noStore });
  }
  if (Number(request.headers.get('content-length') || 0) > 25000) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }
  try {
    const body = await request.json();
    const action = String(body?.action || '');
    if (action !== 'challenge' && action !== 'claim') return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    const idToken = String(body?.idToken || '');
    if (idToken.length < 100 || idToken.length > 5000) throw new Error('Valid reseller login required.');
    const user = await getAdminAuth().verifyIdToken(idToken, true);
    if (action === 'challenge') {
      const result = await bonusChallenge(user.uid, String(body?.androidId || ''));
      return NextResponse.json({ ok: true, ...result }, { headers: noStore });
    }
    const result = await claimPlayInstallBonus(user.uid, String(body?.androidId || ''), String(body?.integrityToken || ''));
    return NextResponse.json({ ok: true, ...result }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Play Store reward request failed.';
    // Never award money on offline, invalid attestation, or missing configuration.
    return NextResponse.json({ error: message }, { status: 403, headers: noStore });
  }
}

export async function GET() {
  return NextResponse.json({ enabled: bonusIsEnabled(), amount: PLAY_INSTALL_BONUS_RUPEES }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
