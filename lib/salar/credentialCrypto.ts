import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

function encryptionKey() {
  // A dedicated key can be supplied; otherwise derive a purpose-specific key from
  // the existing server-only service credential. Never use a publishable key.
  const root = process.env.SALAR_KEYS_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!root || root.length < 32) throw new Error('Server encryption is not configured.');
  return Buffer.from(hkdfSync('sha256', root, 'primehub-salar-v1', 'provider-credentials', 32));
}
export function sealCredentials(provider: string, value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(provider));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function openCredentials(provider: string, envelope: string) {
  const [version, iv, tag, payload, extra] = envelope.split('.');
  if (version !== 'v1' || !iv || !tag || !payload || extra) throw new Error('Invalid credential envelope.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(provider));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8'));
}
