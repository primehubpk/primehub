import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const WALLET_ADMIN_COOKIE = 'primehub_wallet_admin_session';
const SESSION_SECONDS = 60 * 60 * 4;

function secret() { return String(process.env.ADMIN_PASSWORD || ''); }

export function adminPasswordMatches(password: string): boolean {
  const expected = secret();
  if (!expected || password.length === 0) return false;
  const supplied = createHmac('sha256', 'primehub-admin-password-comparison').update(password).digest();
  const stored = createHmac('sha256', 'primehub-admin-password-comparison').update(expected).digest();
  return timingSafeEqual(supplied, stored);
}

export function issueWalletAdminSession(now = Math.floor(Date.now() / 1000)) {
  if (!secret()) throw new Error('ADMIN_PASSWORD must be configured.');
  const payload = `${randomBytes(24).toString('base64url')}.${now}`;
  const signature = createHmac('sha256', secret()).update(`wallet-admin:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

export function authorizedWalletAdmin(request: Request, now = Math.floor(Date.now() / 1000)) {
  if (!secret()) return false;
  const token = (request.headers.get('cookie') || '').split(';').map(v => v.trim())
    .find(v => v.startsWith(`${WALLET_ADMIN_COOKIE}=`))?.slice(WALLET_ADMIN_COOKIE.length + 1) || '';
  const [nonce, issued, signature, extra] = token.split('.');
  if (extra || !/^[A-Za-z0-9_-]{32}$/.test(nonce || '') || !/^\d+$/.test(issued || '') || !signature) return false;
  const age = now - Number(issued);
  if (age < 0 || age >= SESSION_SECONDS) return false;
  const expected = createHmac('sha256', secret()).update(`wallet-admin:${nonce}.${issued}`).digest('base64url');
  return expected.length === signature.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function walletAdminCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: SESSION_SECONDS };
}
