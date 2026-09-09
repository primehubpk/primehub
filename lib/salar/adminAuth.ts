import 'server-only';

const ADMIN_COOKIE = 'primehub_admin_auth';

export function isExistingPrimeHubAdminRequest(request: Request): boolean {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === `${ADMIN_COOKIE}=true`);
}
