import 'server-only';

import { revalidateTag, unstable_cache } from 'next/cache';
import { getSupabasePrimaryPayload, mapDocumentToSupabase, supabasePrimaryUpsert } from '@/lib/dualWriteServer';

export type SalarWhatsAppContact = { id: 'business' | 'helpline'; label: string; number: string; enabled: boolean };

const DEFAULT_CONTACTS: SalarWhatsAppContact[] = [
  { id: 'business', label: 'PrimeHub', number: '03035958676', enabled: true },
  { id: 'helpline', label: 'Complaints / Helpline', number: '03238878009', enabled: true },
];
export type SalarUiSettings = {
  iconUrl: string;
  whatsappContacts: SalarWhatsAppContact[];
  updatedAt: string | null;
};

const SETTINGS_ID = 'salar_ui';
const SETTINGS_TAG = 'salar-ui-settings';

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

export function normalizedWhatsAppPhone(value: unknown) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  const full = /^03\d{9}$/.test(digits) ? '92' + digits.slice(1) : /^3\d{9}$/.test(digits) ? '92' + digits : digits;
  if (!/^923\d{9}$/.test(full)) throw new Error('Enter a valid Pakistan WhatsApp number (03XXXXXXXXX).');
  return '0' + full.slice(2);
}
function normalizeContacts(value: unknown): SalarWhatsAppContact[] {
  const rows = Array.isArray(value) ? value : DEFAULT_CONTACTS;
  return DEFAULT_CONTACTS.map(base => {
    const record = rows.find((row: any) => row?.id === base.id);
    return {
      ...base,
      number: record ? normalizedWhatsAppPhone(record.number) : base.number,
      enabled: record?.enabled === undefined ? base.enabled : record.enabled === true,
    };
  });
}
function normalize(payload: Record<string, any> | null): SalarUiSettings {
  return {
    iconUrl: safeHttpsUrl(payload?.iconUrl),
    whatsappContacts: normalizeContacts(payload?.whatsappContacts),
    updatedAt: typeof payload?.updatedAt === 'string' ? payload.updatedAt : null,
  };
}

async function readSalarUiSettings() {
  return normalize(await getSupabasePrimaryPayload('settings', SETTINGS_ID));
}

const readCachedSalarUiSettings = unstable_cache(
  readSalarUiSettings,
  ['primehub-salar-ui-v1'],
  { revalidate: 3600, tags: [SETTINGS_TAG] },
);

export function getSalarUiSettings() {
  return readCachedSalarUiSettings();
}

export async function saveSalarUiSettings(input: { iconUrl?: unknown; whatsappContacts?: unknown }) {
  const current = await readSalarUiSettings();
  const next: SalarUiSettings = {
    iconUrl: input.iconUrl === undefined ? current.iconUrl : safeHttpsUrl(input.iconUrl),
    whatsappContacts: input.whatsappContacts === undefined ? current.whatsappContacts : normalizeContacts(input.whatsappContacts),
    updatedAt: new Date().toISOString(),
  };
  const row = mapDocumentToSupabase('settings', SETTINGS_ID, next, 'supabase');
  if (!row) throw new Error('Could not build Salar UI settings row.');
  await supabasePrimaryUpsert({ table: 'settings', row });
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  return next;
}
