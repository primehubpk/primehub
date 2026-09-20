import 'server-only';

import { unstable_cache, revalidateTag } from 'next/cache';
import { openCredentials, sealCredentials } from '@/lib/salar/credentialCrypto';
import { TIKTOK_PIXEL_ID } from '@/lib/tiktokConfig';

const TABLE = 'integration_secrets';
const INTEGRATION = 'tiktok_events';
const TAG = 'integration-tiktok-events';

export type TikTokEventsSettings = {
  pixelId: string;
  accessToken: string;
  enabled: boolean;
  testEventCode: string;
};

const defaults: TikTokEventsSettings = {
  pixelId: TIKTOK_PIXEL_ID,
  accessToken: '',
  enabled: false,
  testEventCode: '',
};

async function database(query: string, init: RequestInit = {}) {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Integration storage is not configured.');

  const response = await fetch(`${url}/rest/v1/${TABLE}${query}`, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(3000),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) throw new Error(`Integration storage unavailable (${response.status}).`);
  return response;
}

const readRow = unstable_cache(async () => {
  const response = await database(`?select=envelope&integration=eq.${INTEGRATION}&limit=1`);
  const rows = await response.json() as Array<{ envelope?: string }>;
  return rows[0]?.envelope || '';
}, ['integration-tiktok-events-v1'], { revalidate: 300, tags: [TAG] });

export async function getTikTokEventsSettings(): Promise<TikTokEventsSettings> {
  const envelope = await readRow();
  if (!envelope) return defaults;
  const value = openCredentials(`integration:${INTEGRATION}`, envelope) as Partial<TikTokEventsSettings>;
  return {
    pixelId: String(value.pixelId || TIKTOK_PIXEL_ID).trim(),
    accessToken: String(value.accessToken || '').trim(),
    enabled: value.enabled === true,
    testEventCode: String(value.testEventCode || '').trim(),
  };
}

export async function getTikTokEventsSummary() {
  const settings = await getTikTokEventsSettings();
  return {
    pixelId: settings.pixelId,
    enabled: settings.enabled,
    tokenConfigured: Boolean(settings.accessToken),
    testEventCode: settings.testEventCode,
  };
}

function validPixelId(value: string) {
  return /^[A-Za-z0-9_-]{5,80}$/.test(value);
}

function validTestCode(value: string) {
  return !value || /^[A-Za-z0-9_-]{1,120}$/.test(value);
}

export async function saveTikTokEventsSettings(input: {
  pixelId?: unknown;
  accessToken?: unknown;
  enabled?: unknown;
  testEventCode?: unknown;
  removeToken?: unknown;
}) {
  const current = await getTikTokEventsSettings();
  const pixelId = input.pixelId === undefined ? current.pixelId : String(input.pixelId || '').trim();
  if (!validPixelId(pixelId)) throw new Error('TikTok Pixel ID format is invalid.');

  const testEventCode = input.testEventCode === undefined
    ? current.testEventCode
    : String(input.testEventCode || '').trim();
  if (!validTestCode(testEventCode)) throw new Error('TikTok test event code format is invalid.');

  let accessToken = current.accessToken;
  if (input.removeToken === true) accessToken = '';
  else if (input.accessToken !== undefined && String(input.accessToken || '').trim()) {
    accessToken = String(input.accessToken || '').trim();
  }

  if (accessToken && (accessToken.length < 8 || accessToken.length > 4096 || /\s/.test(accessToken))) {
    throw new Error('TikTok access token format is invalid.');
  }

  const enabled = input.enabled === true;
  if (enabled && !accessToken) throw new Error('Add the TikTok Events API access token before enabling server events.');

  const next: TikTokEventsSettings = { pixelId, accessToken, enabled, testEventCode };
  const envelope = sealCredentials(`integration:${INTEGRATION}`, next);

  await database('?on_conflict=integration', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      integration: INTEGRATION,
      envelope,
      updated_at: new Date().toISOString(),
    }),
  });

  revalidateTag(TAG, { expire: 0 });
  return next;
}
