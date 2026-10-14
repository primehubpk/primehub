import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { bonusIsEnabled, claimPlayInstallBonus, PLAY_INSTALL_BONUS_RUPEES } from '@/lib/playInstallBonus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

// One low-friction welcome gift to existing email/password users of the native app.
// CAUTION: installer name and Android ID are native-client assertions, not
// cryptographic attestation; users with a modified client can spoof them.
export async function POST(request: Request) {
  if (!bonusIsEnabled()) {
    return NextResponse.json({ error: 'Bonus not enabled yet.' }, { status: 503, headers });
  }
  const size = Number(request.headers.get('content-length') || 0);
  if (size > 10000) return NextResponse.json({ error: 'Request too large.' }, { status: 413, headers });
  try {
    const body = await request.json();
    if (body?.action !== 'claim') return NextResponse.json({ error: 'Invalid action.' }, { status: 400, headers });
    const token = String(body?.idToken || '');
    if (token.length < 100 || token.length > 5000) throw new Error('Sign in with your PrimeHub account.');
    const user = await getAdminAuth().verifyIdToken(token, true);
    const result = await claimPlayInstallBonus(
      user.uid, String(user.email || ''), String(body?.androidId || ''),
      String(body?.installer || ''),
    );
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Bonus unavailable.',
    }, { status: 403, headers });
  }
}

export async function GET() {
  return NextResponse.json({ enabled: bonusIsEnabled(), amount: PLAY_INSTALL_BONUS_RUPEES },
    { headers });
}
