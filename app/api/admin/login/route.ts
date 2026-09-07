import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { PRIMEHUB_ADMIN_EMAIL, PRIMEHUB_ADMIN_UID } from '@/lib/adminSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const configuredPassword = process.env.ADMIN_PASSWORD?.trim();

    if (!configuredPassword) {
      console.error('ADMIN_PASSWORD is not configured for PrimeHub admin login.');
      return NextResponse.json({ success: false, error: 'Admin login is not configured.' }, { status: 503 });
    }
    if (email !== PRIMEHUB_ADMIN_EMAIL || password !== configuredPassword) {
      return NextResponse.json({ success: false, error: 'Invalid admin credentials.' }, { status: 401 });
    }

    const customToken = await getAdminAuth().createCustomToken(PRIMEHUB_ADMIN_UID, {
      admin: true,
      email: PRIMEHUB_ADMIN_EMAIL,
    });
    const response = NextResponse.json({ success: true, customToken }, { status: 200 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Admin login route error', error);
    return NextResponse.json({ success: false, error: 'Admin authentication service is unavailable.' }, { status: 500 });
  }
}
