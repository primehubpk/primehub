import 'server-only';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const WALLET_ADMIN_COOKIE = 'primehub_wallet_admin_session';
const SESSION_SECONDS = 60 * 60 * 4;
const CREDENTIAL_PATH = 'admin_login_credentials';

// Original Admin Panel password, stored as a scrypt verifier rather than
// plaintext in Git. No Vercel ADMIN_PASSWORD environment variable is needed.
// Once changed through Admin > Settings, the saved salted verifier takes over.
const DEFAULT_PASSWORD_SALT = '97200820b5bf7758d0e8e8249bd39eb4';
const DEFAULT_PASSWORD_HASH = '91b4abfc152e9ef56850088c7026421919c0526a47698af8b26399c57e71c3c5bb523352a7255669694b4bafde2fd030a654659c34db19c376081536909473c5';

function sessionSecret(): Buffer {
  // Reuse the already-configured Firebase Admin service-account private key
  // to derive a separate HMAC signing key. This adds no new secrets, environment
  // variables, Firestore reads or Vercel configuration for admin passwords.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Firebase server credentials are unavailable.');
  const credentials = JSON.parse(raw) as { private_key?: string };
  if (!credentials.private_key?.includes('PRIVATE KEY')) {
    throw new Error('Firebase server credentials are invalid.');
  }
  return createHmac('sha256', credentials.private_key)
    .update('primehub:wallet-admin:session-hmac:v1')
    .digest();
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

/** Only logins and Settings password changes read the single Firestore
 * credential document. A custom password takes precedence over the original.
 * The original login needs no ADMIN_PASSWORD environment variable.
 */
export async function adminPasswordMatches(password: string): Promise<boolean> {
  if (!password || password.length > 128) return false;
  const record = await getAdminDb().collection(CREDENTIAL_PATH).doc('primary').get();
  if (record.exists) return verifyStoredPassword(password, record.data() as AdminCredential);
  return verifyStoredPassword(password, {
    algorithm: 'scrypt-v1',
    salt: DEFAULT_PASSWORD_SALT,
    hash: DEFAULT_PASSWORD_HASH,
  });
}

export async function setAdminPassword(password: string) {
  const record = adminPasswordRecord(password);
  await getAdminDb().collection(CREDENTIAL_PATH).doc('primary').set({
    ...record, updatedAt: new Date().toISOString(),
  });
}

export function issueWalletAdminSession(now = Math.floor(Date.now() / 1000)) {
  const payload = `${randomBytes(24).toString('base64url')}.${now}`;
  const signature = createHmac('sha256', sessionSecret())
    .update(`wallet-admin:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

export function authorizedWalletAdmin(request: Request, now = Math.floor(Date.now() / 1000)) {
  let key: Buffer;
  try { key = sessionSecret(); } catch { return false; }
  const token = (request.headers.get('cookie') || '').split(';').map(v => v.trim())
    .find(v => v.startsWith(`${WALLET_ADMIN_COOKIE}=`))?.slice(WALLET_ADMIN_COOKIE.length + 1) || '';
  const [nonce, issued, signature, extra] = token.split('.');
  if (extra || !/^[A-Za-z0-9_-]{32}$/.test(nonce || '') || !/^\d+$/.test(issued || '') || !signature) return false;
  const age = now - Number(issued);
  if (age < 0 || age >= SESSION_SECONDS) return false;
  const expected = createHmac('sha256', key)
    .update(`wallet-admin:${nonce}.${issued}`).digest('base64url');
  return expected.length === signature.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function walletAdminCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: SESSION_SECONDS };
}
