import 'server-only';

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
