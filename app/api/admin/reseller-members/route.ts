import { NextResponse } from 'next/server';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';
import { manageResellerMember } from '@/lib/manageResellerMember';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!authorizedWalletAdmin(request)) return NextResponse.json({ error: 'Secure admin session required. Sign out and sign in.' }, { status: 401 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Origin mismatch.' }, { status: 403 });
  try {
    const body = await request.json();
    const action = String(body?.action || '');
    if (!['block','unblock','delete'].includes(action)) return NextResponse.json({ error: 'Unknown account action.' }, { status: 400 });
    const result = await manageResellerMember(String(body?.userId || ''), action as 'block' | 'unblock' | 'delete', String(body?.reason || ''));
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to manage this member.' }, { status: 400 });
  }
}
