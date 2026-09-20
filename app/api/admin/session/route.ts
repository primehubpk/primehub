import { PRIMEHUB_ADMIN_SESSION_COOKIE } from '@/lib/adminSession';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_COOKIE = 'primehub_admin_auth';

function hasAdminCookie(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === `${ADMIN_COOKIE}=true`);
}

export async function GET(request: Request) {
  const authenticated = hasAdminCookie(request);
  const response = NextResponse.json({ authenticated });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function DELETE(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ authenticated: false }, { status: 403 });
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(PRIMEHUB_ADMIN_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

