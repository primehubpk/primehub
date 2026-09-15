import 'server-only';

import { getSupabasePrimaryPayload, mapDocumentToSupabase, supabasePrimaryUpsert } from '@/lib/dualWriteServer';

export type SalarUiSettings = {
  iconUrl: string;
  updatedAt: string | null;
};

const SETTINGS_ID = 'salar_ui';

function safeHttpsUrl(value: unknown) {
  const text = String(value ?? '').trim().slice(0, 1600);
  if (!text) return '';
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function normalize(payload: Record<string, any> | null): SalarUiSettings {
  return {
    iconUrl: safeHttpsUrl(payload?.iconUrl),
    updatedAt: typeof payload?.updatedAt === 'string' ? payload.updatedAt : null,
  };
}

export async function getSalarUiSettings() {
  return normalize(await getSupabasePrimaryPayload('settings', SETTINGS_ID));
}

export async function saveSalarUiSettings(input: { iconUrl?: unknown }) {
  const current = await getSalarUiSettings();
  const next: SalarUiSettings = {
    iconUrl: input.iconUrl === undefined ? current.iconUrl : safeHttpsUrl(input.iconUrl),
    updatedAt: new Date().toISOString(),
  };
  const row = mapDocumentToSupabase('settings', SETTINGS_ID, next, 'supabase');
  if (!row) throw new Error('Could not build Salar UI settings row.');
  await supabasePrimaryUpsert({ table: 'settings', row });
  return next;
}
