import { NextResponse } from 'next/server';
import { adminPasswordMatches, authorizedWalletAdmin, setAdminPassword, WALLET_ADMIN_COOKIE, walletAdminCookieOptions } from '@/lib/walletAdminSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers: noStore });
  }
  if (!authorizedWalletAdmin(request)) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401, headers: noStore });
  }
  if (Number(request.headers.get('content-length') || 0) > 3000) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 413, headers: noStore });
  }
  try {
    const body = await request.json();
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (newPassword.length < 12 || newPassword.length > 128 || currentPassword === newPassword) {
      return NextResponse.json({ error: 'Choose a different new password with at least 12 characters.' }, { status: 400, headers: noStore });
    }
    if (!(await adminPasswordMatches(currentPassword))) {
      return NextResponse.json({ error: 'Current Admin Panel password is incorrect.' }, { status: 401, headers: noStore });
    }
    // Only a salted scrypt hash is stored in a Firestore server-only collection.
    // This updates the exact password used by /api/admin/login, not Firebase Auth.
    await setAdminPassword(newPassword);
    const response = NextResponse.json({ success: true, reauthenticate: true }, { headers: noStore });
    response.cookies.set('primehub_admin_auth', '', {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: 0,
    });
    response.cookies.set(WALLET_ADMIN_COOKIE, '', { ...walletAdminCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    console.error('Admin password update failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Unable to change password. Please try again.' }, { status: 503, headers: noStore });
  }
}
