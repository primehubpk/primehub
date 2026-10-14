import { NextResponse } from 'next/server';
import { adminPasswordMatches, issueWalletAdminSession, WALLET_ADMIN_COOKIE, walletAdminCookieOptions } from '@/lib/walletAdminSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_COOKIE = 'primehub_admin_auth';
const MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!adminPasswordMatches(password)) {
    return NextResponse.json({ success: false, error: 'Wrong password.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true, authenticated: true }, { status: 200 });
  response.cookies.set(WALLET_ADMIN_COOKIE, issueWalletAdminSession(), walletAdminCookieOptions());
  response.cookies.set(ADMIN_COOKIE, 'true', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
