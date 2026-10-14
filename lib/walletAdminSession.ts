import 'server-only';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const WALLET_ADMIN_COOKIE = 'primehub_wallet_admin_session';
const SESSION_SECONDS = 60 * 60 * 4;
const CREDENTIAL_PATH = 'admin_login_credentials';

function sessionSecret() {
  // This is an independent, high-entropy signing key. Never derive signed
  // cookies from the user-selected admin password, which may be short.
  return String(process.env.ADMIN_SESSION_SECRET || '');
}

type AdminCredential = { algorithm?: string; salt?: string; hash?: string };

function verifyStoredPassword(password: string, data: AdminCredential): boolean {
  if (data.algorithm !== 'scrypt-v1' ||
      !/^[0-9a-f]{32}$/.test(data.salt || '') ||
      !/^[0-9a-f]{128}$/.test(data.hash || '')) return false;
  const derived = scryptSync(password, Buffer.from(data.salt!, 'hex'), 64);
  return timingSafeEqual(derived, Buffer.from(data.hash!, 'hex'));
}

export function adminPasswordRecord(password: string) {
  if (password.length < 12 || password.length > 128) {
    throw new Error('New admin password must contain 12–128 characters.');
  }
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return { algorithm: 'scrypt-v1', salt: salt.toString('hex'), hash: derived.toString('hex') };
}

/** Only admin logins/password changes read one Firestore credential document.
 * This avoids any DB calls on protected admin API requests.
 * Once a custom password is saved, the initial Vercel password is no longer
 * accepted for login even if that environment variable still exists.
 */
export async function adminPasswordMatches(password: string): Promise<boolean> {
  if (!password || password.length > 128) return false;
  const record = await getAdminDb().collection(CREDENTIAL_PATH).doc('primary').get();
  if (record.exists) return verifyStoredPassword(password, record.data() as AdminCredential);
  const initial = String(process.env.ADMIN_PASSWORD || '');
  if (!initial) return false;
  const submitted = createHmac('sha256', 'primehub-admin-login-v2').update(password).digest();
  const expected = createHmac('sha256', 'primehub-admin-login-v2').update(initial).digest();
  return timingSafeEqual(submitted, expected);
}

export async function setAdminPassword(password: string) {
  const record = adminPasswordRecord(password);
  await getAdminDb().collection(CREDENTIAL_PATH).doc('primary').set({
    ...record, updatedAt: new Date().toISOString(),
  });
}

export function issueWalletAdminSession(now = Math.floor(Date.now() / 1000)) {
  const key = sessionSecret();
  if (key.length < 32) throw new Error('ADMIN_SESSION_SECRET must be configured.');
  const payload = `${randomBytes(24).toString('base64url')}.${now}`;
  const signature = createHmac('sha256', key).update(`wallet-admin:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

export function authorizedWalletAdmin(request: Request, now = Math.floor(Date.now() / 1000)) {
  const key = sessionSecret();
  if (key.length < 32) return false;
  const token = (request.headers.get('cookie') || '').split(';').map(v => v.trim())
    .find(v => v.startsWith(`${WALLET_ADMIN_COOKIE}=`))?.slice(WALLET_ADMIN_COOKIE.length + 1) || '';
  const [nonce, issued, signature, extra] = token.split('.');
  if (extra || !/^[A-Za-z0-9_-]{32}$/.test(nonce || '') || !/^\d+$/.test(issued || '') || !signature) return false;
  const age = now - Number(issued);
  if (age < 0 || age >= SESSION_SECONDS) return false;
  const expected = createHmac('sha256', key).update(`wallet-admin:${nonce}.${issued}`).digest('base64url');
  return expected.length === signature.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function walletAdminCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: SESSION_SECONDS };
}
