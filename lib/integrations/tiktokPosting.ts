import 'server-only';

import { openCredentials, sealCredentials } from '@/lib/salar/credentialCrypto';

const INTEGRATION = 'tiktok_posting_sandbox';
const CONTEXT = `integration:${INTEGRATION}`;

type Credentials = {
  openId: string;
  scope: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
};

export function tiktokConfig() {
  const clientKey = process.env.TIKTOK_SANDBOX_CLIENT_KEY || '';
  const clientSecret = process.env.TIKTOK_SANDBOX_CLIENT_SECRET || '';
  const redirectUri = 'https://www.primehubmall.com/api/tiktok/oauth/callback';
  if (!clientKey || !clientSecret) throw new Error('TikTok sandbox credentials are not configured on the server.');
  return { clientKey, clientSecret, redirectUri };
}

async function requestStorage(query: string, init: RequestInit = {}) {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Secure integration storage is unavailable.');
  const result = await fetch(`${url}/rest/v1/integration_secrets${query}`, {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(10000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!result.ok) throw new Error(`Secure integration storage failed (${result.status}).`);
  return result;
}

export async function getPostingCredentials(): Promise<Credentials | null> {
  const result = await requestStorage(`?select=envelope&integration=eq.${INTEGRATION}&limit=1`);
  const rows = await result.json() as Array<{ envelope: string }>;
  return rows[0] ? openCredentials(CONTEXT, rows[0].envelope) as Credentials : null;
}

async function savePostingCredentials(value: Credentials) {
  await requestStorage('?on_conflict=integration', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ integration: INTEGRATION, envelope: sealCredentials(CONTEXT, value), updated_at: new Date().toISOString() }),
  });
}

export async function disconnectPosting() {
  await requestStorage(`?integration=eq.${INTEGRATION}`, { method: 'DELETE' });
}

async function tokenRequest(body: URLSearchParams) {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token || !token.refresh_token || !token.open_id) {
    throw new Error(`TikTok authorization failed: ${String(token.error || 'unknown_error')}`);
  }
  return token as { access_token: string; refresh_token: string; open_id: string; scope: string; expires_in: number; refresh_expires_in: number };
}

function tokenValues(token: Awaited<ReturnType<typeof tokenRequest>>): Credentials {
  return {
    openId: token.open_id, scope: token.scope, accessToken: token.access_token,
    refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000,
    refreshExpiresAt: Date.now() + token.refresh_expires_in * 1000,
  };
}

export async function exchangePostingCode(code: string) {
  const config = tiktokConfig();
  const token = await tokenRequest(new URLSearchParams({
    client_key: config.clientKey, client_secret: config.clientSecret,
    code, grant_type: 'authorization_code', redirect_uri: config.redirectUri,
  }));
  if (!token.scope.split(',').includes('video.publish')) throw new Error('TikTok video.publish consent was not granted.');
  await savePostingCredentials(tokenValues(token));
}

export async function postingAccessToken() {
  const saved = await getPostingCredentials();
  if (!saved) throw new Error('Connect a TikTok account first.');
  if (!saved.scope.split(',').includes('video.publish')) throw new Error('TikTok video.publish permission is missing.');
  if (saved.expiresAt > Date.now() + 60000) return saved.accessToken;
  if (saved.refreshExpiresAt < Date.now()) throw new Error('TikTok authorization expired. Connect again.');
  const config = tiktokConfig();
  const token = await tokenRequest(new URLSearchParams({
    client_key: config.clientKey, client_secret: config.clientSecret,
    grant_type: 'refresh_token', refresh_token: saved.refreshToken,
  }));
  if (token.open_id !== saved.openId) throw new Error('TikTok account changed during refresh.');
  await savePostingCredentials(tokenValues(token));
  return token.access_token;
}

export async function postingApi(path: string, body: object = {}) {
  const token = await postingAccessToken();
  const response = await fetch(`https://open.tiktokapis.com/v2/post/publish/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || result.error?.code !== 'ok') {
    throw new Error(`TikTok: ${String(result.error?.code || response.status)} ${String(result.error?.message || '')}`);
  }
  return result.data;
}
