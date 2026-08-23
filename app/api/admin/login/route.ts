import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const ADMIN_EMAIL = 'primehubpk1@gmail.com';
const ADMIN_UID = 'BZfIarsxGkXwZUIEcfFXa9u7Ge02';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const configuredPassword = process.env.ADMIN_PASSWORD || 'junaid00';

    if (email !== ADMIN_EMAIL || password !== configuredPassword) {
      return NextResponse.json({ success: false, error: 'Invalid password. Please enter correct credentials.' }, { status: 401 });
    }

    const customToken = await getAdminAuth().createCustomToken(ADMIN_UID, { admin: true, email: ADMIN_EMAIL });
    return NextResponse.json({ success: true, customToken }, { status: 200 });
  } catch (error) {
    console.error('Admin login route error', error);
    return NextResponse.json({ success: false, error: 'Admin authentication service is unavailable.' }, { status: 500 });
  }
}
