import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';
import { creditResellerWallet } from '@/lib/resellerWalletCredits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function responseError(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Wallet request failed.' }, { status: 400 });
}

export async function GET(request: Request) {
  if (!authorizedWalletAdmin(request)) return NextResponse.json({ error: 'Wallet admin login required. Sign out and sign back in.' }, { status: 401 });
  try {
    const snap = await getAdminDb().collection('reseller_wallet_credits').orderBy('createdAt', 'desc').limit(100).get();
    const credits = snap.docs.map(doc => {
      const row = doc.data();
      return { id: doc.id, userId: row.userId, amount: row.amount, purpose: row.purpose, reason: row.reason, createdAt: row.createdAt?.toDate?.()?.toISOString() || null };
    });
    return NextResponse.json({ credits }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return responseError(error); }
}

export async function POST(request: Request) {
  if (!authorizedWalletAdmin(request)) return NextResponse.json({ error: 'Wallet admin login required. Sign out and sign back in.' }, { status: 401 });
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Origin mismatch.' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const result = await creditResellerWallet({
      userId: String(body?.userId || ''),
      amount: body?.amount,
      purpose: body?.purpose,
      reason: String(body?.reason || ''),
      operationId: String(body?.operationId || ''),
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return responseError(error); }
}
