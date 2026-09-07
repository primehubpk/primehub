import 'server-only';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const PRIMEHUB_ADMIN_SESSION_COOKIE = 'primehub_admin_session';
export const PRIMEHUB_ADMIN_EMAIL = 'primehubpk1@gmail.com';
export const PRIMEHUB_ADMIN_UID = 'BZfIarsxGkXwZUIEcfFXa9u7Ge02';
export const PRIMEHUB_ADMIN_SESSION_MAX_AGE = 24 * 60 * 60;

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get('cookie') || '';
  for (const chunk of cookie.split(';')) {
    const [rawName, ...rest] = chunk.trim().split('=');
    if (rawName === name) return rest.join('=').trim();
  }
  return '';
}

export async function verifyPrimeHubAdminRequest(request: Request) {
  const sessionCookie = cookieValue(request, PRIMEHUB_ADMIN_SESSION_COOKIE);
  if (!sessionCookie) return null;
  try {
    const claims = await getAdminAuth().verifySessionCookie(sessionCookie, false);
    const email = String(claims.email || '').trim().toLowerCase();
    if (claims.uid !== PRIMEHUB_ADMIN_UID || email !== PRIMEHUB_ADMIN_EMAIL || claims.admin !== true) return null;
    return claims;
  } catch {
    return null;
  }
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
