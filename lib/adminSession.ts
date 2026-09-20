import 'server-only';

export const PRIMEHUB_ADMIN_SESSION_COOKIE = 'primehub_admin_session';
export const PRIMEHUB_ADMIN_SESSION_MAX_AGE = 24 * 60 * 60;

const ADMIN_COOKIE = 'primehub_admin_auth';

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get('cookie') || '';
  for (const chunk of cookie.split(';')) {
    const [rawName, ...rest] = chunk.trim().split('=');
    if (rawName === name) return rest.join('=').trim();
  }
  return '';
}

export async function verifyPrimeHubAdminRequest(request: Request) {
  if (cookieValue(request, ADMIN_COOKIE) !== 'true') return null;
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
