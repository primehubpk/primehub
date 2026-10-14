import 'server-only';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';

export const PRIMEHUB_ADMIN_SESSION_COOKIE = 'primehub_admin_session';
export const PRIMEHUB_ADMIN_EMAIL = '';
export const PRIMEHUB_ADMIN_UID = '';
export const PRIMEHUB_ADMIN_SESSION_MAX_AGE = 24 * 60 * 60;

export async function verifyPrimeHubAdminRequest(request: Request) {
  if (!authorizedWalletAdmin(request)) return null;
  return { admin: true, source: 'password-session' };
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: PRIMEHUB_ADMIN_SESSION_MAX_AGE,
  };
}
