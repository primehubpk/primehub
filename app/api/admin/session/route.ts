import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import {
  PRIMEHUB_ADMIN_EMAIL,
  PRIMEHUB_ADMIN_SESSION_COOKIE,
  PRIMEHUB_ADMIN_SESSION_MAX_AGE,
  PRIMEHUB_ADMIN_UID,
  adminSessionCookieOptions,
  verifyPrimeHubAdminRequest,
} from '@/lib/adminSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function GET(request: Request) {
  const admin = await verifyPrimeHubAdminRequest(request);
  return NextResponse.json({ authenticated: Boolean(admin), email: admin ? PRIMEHUB_ADMIN_EMAIL : null });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const idToken = clean(body?.idToken);
    if (!idToken) return NextResponse.json({ authenticated: false, error: 'ID token required.' }, { status: 400 });

    const decoded = await getAdminAuth().verifyIdToken(idToken, true);
    const email = String(decoded.email || '').trim().toLowerCase();
    if (decoded.uid !== PRIMEHUB_ADMIN_UID || email !== PRIMEHUB_ADMIN_EMAIL || decoded.admin !== true) {
      return NextResponse.json({ authenticated: false, error: 'Unauthorized admin account.' }, { status: 403 });
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: PRIMEHUB_ADMIN_SESSION_MAX_AGE * 1000,
    });
    const response = NextResponse.json({ authenticated: true, email: PRIMEHUB_ADMIN_EMAIL });
    response.cookies.set(PRIMEHUB_ADMIN_SESSION_COOKIE, sessionCookie, adminSessionCookieOptions());
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Admin session creation failed', error);
    return NextResponse.json({ authenticated: false, error: 'Admin session could not be created.' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(PRIMEHUB_ADMIN_SESSION_COOKIE, '', {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
