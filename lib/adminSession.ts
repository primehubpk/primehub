import 'server-only';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const PRIMEHUB_ADMIN_SESSION_COOKIE = 'primehub_admin_session';
export const PRIMEHUB_ADMIN_EMAIL = 'primehubpk1@gmail.com';
export const PRIMEHUB_ADMIN_UID = 'BZfIarsxGkXwZUIEcfFXa9u7Ge02';
export const PRIMEHUB_ADMIN_SESSION_MAX_AGE = 24 * 60 * 60;

const LEGACY_ADMIN_COOKIE = 'primehub_admin_auth';
const SALAR_TEST_BRANCH = 'fix/salar-cloudflare-fast-replies';

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get('cookie') || '';
  for (const chunk of cookie.split(';')) {
    const [rawName, ...rest] = chunk.trim().split('=');
    if (rawName === name) return rest.join('=').trim();
  }
  return '';
}

function previewLegacyAdmin(request: Request) {
  // Temporary functional-testing bridge: only this exact Vercel preview branch
  // may reuse the existing password admin cookie. Production never enters here.
  if (process.env.VERCEL_ENV !== 'preview') return null;
  if (process.env.VERCEL_GIT_COMMIT_REF !== SALAR_TEST_BRANCH) return null;
  if (cookieValue(request, LEGACY_ADMIN_COOKIE) !== 'true') return null;
  return { uid: PRIMEHUB_ADMIN_UID, email: PRIMEHUB_ADMIN_EMAIL, previewLegacy: true };
}

export async function verifyPrimeHubAdminRequest(request: Request) {
  const previewAdmin = previewLegacyAdmin(request);
  if (previewAdmin) return previewAdmin;

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
