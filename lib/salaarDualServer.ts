import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mirrorSupabaseDelete, mirrorSupabaseUpsert, recordMirrorFailure } from '@/lib/dualWriteServer';
import { sanitizeSalaarImageUrls } from '@/lib/salaarAiRouter';

function safe(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(safe);
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safe(v)]));
  return value;
}

function iso(value: any): string | null {
  if (!value) return null;
  try {
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch { return null; }
}

function supabaseCfg() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  return { url, key, configured: Boolean(url && key) };
}

async function supabaseGet(path: string) {
  const { url, key, configured } = supabaseCfg();
  if (!configured) return null;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase read failed ${response.status}`);
  return response.json();
}

export async function mirrorSalaarConversation(sessionId: string) {
  const snap = await getAdminDb().collection('salaar_conversations').doc(sessionId).get();
  if (!snap.exists) return;
  const d = snap.data() || {};
  const row = {
    session_id: sessionId,
    status: d.status || 'AUTO',
    hold_type: d.holdType ?? null,
    soft_hold_until: iso(d.softHoldUntil),
    need_you: Boolean(d.needYou),
    order_stage: d.orderStage ?? null,
    advance_required: Number(d.advanceRequired || 0) || null,
    cart_summary: safe(d.cartSummary ?? null),
    pending_customer_message: d.pendingCustomerMessage ?? null,
    pending_shown_product_ids: safe(Array.isArray(d.pendingShownProductIds) ? d.pendingShownProductIds : []),
    pending_message_doc_id: d.pendingMessageDocId ?? null,
    last_message: d.lastMessage ?? null,
    last_role: d.lastRole ?? null,
    payload: safe(d),
    authoritative_source: 'firebase',
    mirror_status: 'synced',
    mirror_error: null,
    updated_at: iso(d.updatedAt) || new Date().toISOString(),
    sync_version: Number(d.syncVersion || 1),
  };
  const result = await mirrorSupabaseUpsert({ table: 'salaar_conversations', row, conflict: 'session_id' });
  if (result.attempted && !result.ok) await recordMirrorFailure('salaar_conversations', sessionId, 'upsert', row);
}

export async function mirrorSalaarMessage(sessionId: string, messageId: string) {
  const snap = await getAdminDb().collection('salaar_conversations').doc(sessionId).collection('messages').doc(messageId).get();
  if (!snap.exists) return;
  const d = snap.data() || {};
  const row = {
    id: messageId,
    session_id: sessionId,
    role: String(d.role || 'salaar'),
    text: d.text ?? null,
    pending: Boolean(d.pending),
    payload: safe(d),
    authoritative_source: 'firebase',
    mirror_status: 'synced',
    mirror_error: null,
    created_at: iso(d.createdAt) || new Date().toISOString(),
    updated_at: iso(d.updatedAt) || iso(d.createdAt) || new Date().toISOString(),
    sync_version: Number(d.syncVersion || 1),
  };
  const result = await mirrorSupabaseUpsert({ table: 'salaar_messages', row, conflict: 'id' });
  if (result.attempted && !result.ok) await recordMirrorFailure('salaar_messages', messageId, 'upsert', row);
}

export async function mirrorSalaarMessageDelete(messageId: string) {
  const result = await mirrorSupabaseDelete({ table: 'salaar_messages', id: messageId });
  if (result.attempted && !result.ok) await recordMirrorFailure('salaar_messages', messageId, 'delete', { id: messageId });
}

export async function loadSupabaseSalaarHistory(sessionId: string) {
  const rows = await supabaseGet(`salaar_messages?session_id=eq.${encodeURIComponent(sessionId)}&select=id,role,text,created_at,payload&order=created_at.asc&limit=30`);
  if (!Array.isArray(rows)) return [];
  return rows.map((row: any) => ({
    role: row.role === 'customer' ? 'customer' : 'salaar',
    text: String(row.text || ''),
    createdAt: row.created_at || null,
    imageUrls: sanitizeSalaarImageUrls(row?.payload?.imageUrls),
  }));
}

export async function loadSupabaseSalaarState(sessionId: string) {
  const rows = await supabaseGet(`salaar_conversations?session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return {};
  return {
    status: row.status,
    holdType: row.hold_type,
    softHoldUntil: row.soft_hold_until,
    needYou: row.need_you,
    orderStage: row.order_stage,
    advanceRequired: row.advance_required,
    cartSummary: row.cart_summary,
    pendingCustomerMessage: row.pending_customer_message,
    pendingShownProductIds: row.pending_shown_product_ids,
    pendingMessageDocId: row.pending_message_doc_id,
    lastMessage: row.last_message,
    lastRole: row.last_role,
    updatedAt: row.updated_at,
    ...(row.payload && typeof row.payload === 'object' ? row.payload : {}),
  };
}
