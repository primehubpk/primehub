import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_PASSWORD = 'junaid00';
const ADMIN_COOKIE = 'primehub_admin_auth';
const MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ success: false, error: 'Wrong password.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true, authenticated: true }, { status: 200 });
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
