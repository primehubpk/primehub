import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { openCredentials, sealCredentials } from '@/lib/salar/credentialCrypto';
import { PROVIDER_ORDER, type ProviderName, type ProviderCredentials } from '@/lib/salar/providerConfig';

const TAG = 'salar-provider-credentials';
const TABLE = 'salar_provider_secrets';
async function database(query: string, init: RequestInit = {}) {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server credential storage is not configured.');
  const response = await fetch(`${url}/rest/v1/${TABLE}${query}`, {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(3000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) throw new Error(`Credential storage unavailable (${response.status}).`);
  return response;
}
// Cache ciphertext, not plaintext. Never return decrypted values from an API.
const readRows = unstable_cache(async () => {
  const response = await database('?select=provider,envelope');
  return await response.json() as { provider: ProviderName; envelope: string }[];
}, ['salar-provider-credentials-v1'], { revalidate: 300, tags: [TAG] });

export async function getProviderCredentials(): Promise<ProviderCredentials> {
  // Fail closed on storage/decryption errors: a disabled provider must not be
  // silently re-enabled via environment keys when its saved settings are unreadable.
  const rows = await readRows();
  return Object.fromEntries(rows.filter(row => PROVIDER_ORDER.includes(row.provider)).map(row => [row.provider, openCredentials(row.provider, row.envelope)]));
}
export async function credentialSummary() {
  // Admin reads fail visibly, rather than claiming missing keys during an outage.
  const rows = await readRows();
  return Object.fromEntries(rows.map(row => {
    const value = openCredentials(row.provider, row.envelope);
    return [row.provider, { keyCount: value.keys.length, accountId: value.accountId || '', disabled: value.disabled === true, baseUrl: value.baseUrl || '', label: value.label || '' }];
  }));
}
export async function saveProviderCredentials(provider: ProviderName, input: { keys?: unknown; accountId?: unknown; disabled?: unknown; reset?: unknown; baseUrl?: unknown; label?: unknown }) {
  if (!PROVIDER_ORDER.includes(provider)) throw new Error('Unknown provider.');
  if (input.reset === true) {
    await database(`?provider=eq.${provider}`, { method: 'DELETE' });
  } else {
    // One row per provider avoids lost updates when two different providers are edited.
    const response = await database(`?select=envelope&provider=eq.${provider}&limit=1`);
    const rows = await response.json();
    const current = rows[0] ? openCredentials(provider, rows[0].envelope) : { keys: [] };
    const keys = input.keys === undefined ? current.keys : Array.isArray(input.keys) ? [...new Set(input.keys.map(key => String(key).trim()).filter(Boolean))] : null;
    if (!keys || keys.length > 9 || keys.some((key: string) => key.length < 8 || key.length > 4096 || /\s/.test(key))) throw new Error('Enter up to 9 valid API keys.');
    const accountId = input.accountId === undefined ? current.accountId || '' : String(input.accountId).trim();
    if (provider === 'cloudflare' && accountId && !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('Cloudflare account ID must contain 32 hexadecimal characters.');
    const baseUrl = input.baseUrl === undefined ? String(current.baseUrl || '') : String(input.baseUrl || '').trim().replace(/\/+$/, '');
    const label = input.label === undefined ? String(current.label || '') : String(input.label || '').trim();
    if (provider === 'custom') {
      if (baseUrl && (!/^https:\/\//i.test(baseUrl) || baseUrl.length > 500 || /\s/.test(baseUrl))) throw new Error('Custom provider base URL must be a valid HTTPS URL.');
      if (label.length > 80) throw new Error('Custom provider name is too long.');
    }
    const envelope = sealCredentials(provider, { keys, accountId, disabled: input.disabled === true, baseUrl, label });
    await database('?on_conflict=provider', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ provider, envelope, updated_at: new Date().toISOString() }) });
  }
  revalidateTag(TAG, { expire: 0 });
}
