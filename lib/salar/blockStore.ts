import 'server-only';

import {
  mapDocumentToSupabase,
  supabasePrimaryDelete,
  supabasePrimaryUpsert,
} from '@/lib/dualWriteServer';
import type { SalarCustomerChat } from '@/lib/salar/chatStore';

const CHAT_ROW_PREFIX = 'salar_chat_';
const BLOCK_CHAT_PREFIX = 'salar_block_chat_';
const BLOCK_CUSTOMER_PREFIX = 'salar_block_customer_';

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
