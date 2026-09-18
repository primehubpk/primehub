import 'server-only';

import {
  getSupabasePrimaryPayload,
  mapDocumentToSupabase,
  supabasePrimaryDelete,
  supabasePrimaryUpsert,
} from '@/lib/dualWriteServer';
import type { SalarCustomerChat } from '@/lib/salar/chatStore';

const CHAT_ROW_PREFIX = 'salar_chat_';
const BLOCK_CHAT_PREFIX = 'salar_block_chat_';
const BLOCK_CUSTOMER_PREFIX = 'salar_block_customer_';

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  return { url, key, configured: Boolean(url && key) };
}

function cleanIdentity(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function blockRows(chat: Pick<SalarCustomerChat, 'id' | 'customerId' | 'customerName' | 'customerEmail'>) {
  const rows: Array<{ id: string; kind: 'chat' | 'customer'; value: string }> = [];
  const chatId = cleanIdentity(chat.id, 80);
  const customerId = cleanIdentity(chat.customerId, 200);
  if (chatId) rows.push({ id: `${BLOCK_CHAT_PREFIX}${chatId}`, kind: 'chat', value: chatId });
  if (customerId) rows.push({ id: `${BLOCK_CUSTOMER_PREFIX}${customerId}`, kind: 'customer', value: customerId });
  return rows;
}

export async function blockSalarChatIdentity(chat: SalarCustomerChat) {
  const now = new Date().toISOString();
  const rows = blockRows(chat);
  await Promise.all(rows.map(async (entry) => {
    const payload = {
      blocked: true,
      kind: entry.kind,
      value: entry.value,
      chatId: chat.id,
      customerId: chat.customerId || '',
      customerName: chat.customerName || '',
      customerEmail: chat.customerEmail || '',
      blockedAt: now,
      updatedAt: now,
    };
    const row = mapDocumentToSupabase('settings', entry.id, payload, 'supabase');
    if (!row) throw new Error('Could not build Salar block row.');
    await supabasePrimaryUpsert({ table: 'settings', row });
  }));
}

export async function deleteSalarChatRecord(chatIdInput: unknown) {
  const chatId = cleanIdentity(chatIdInput, 80);
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(chatId)) throw new Error('Invalid Salar chat id.');
  await supabasePrimaryDelete({ table: 'settings', id: `${CHAT_ROW_PREFIX}${chatId}` });
}


export async function unblockSalarChatIdentity(chat: SalarCustomerChat) {
  const rows = blockRows(chat);
  await Promise.all(rows.map((entry) => supabasePrimaryDelete({ table: 'settings', id: entry.id })));
}

export async function isSalarChatBlocked(chatIdInput: unknown) {
  const chatId = cleanIdentity(chatIdInput, 80);
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(chatId)) return false;
  const payload = await getSupabasePrimaryPayload('settings', `${BLOCK_CHAT_PREFIX}${chatId}`);
  return payload?.blocked === true;
}

export async function listBlockedSalarChatIds() {
  const { url, key, configured } = supabaseConfig();
  if (!configured) return new Set<string>();

  const params = new URLSearchParams();
  params.set('select', 'id');
  params.set('id', `like.${BLOCK_CHAT_PREFIX}*`);
  params.set('limit', '500');

  const response = await fetch(`${url}/rest/v1/settings?${params.toString()}`, {
    method: 'GET',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Salar blocked chat list failed ${response.status}: ${await response.text()}`);

  const rows = await response.json() as Array<{ id?: string }>;
  return new Set(rows
    .map((row) => String(row.id || ''))
    .filter((id) => id.startsWith(BLOCK_CHAT_PREFIX))
    .map((id) => id.slice(BLOCK_CHAT_PREFIX.length))
    .filter(Boolean));
}
