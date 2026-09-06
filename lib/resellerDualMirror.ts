import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mirrorSupabaseUpsert, recordMirrorFailure } from '@/lib/dualWriteServer';

function safe(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(safe);
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safe(v)]));
  return value;
}

function num(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rowFor(collection: string, id: string, d: Record<string, any>) {
  const payload = safe(d);
  const common = { payload, authoritative_source: 'firebase', mirror_status: 'synced', mirror_error: null, sync_version: Number(d.syncVersion || 1) };
  switch (collection) {
    case 'reseller_profiles':
      return { user_id: id, email: d.email ?? null, status: d.status ?? null, tier_id: d.tierId ?? null, monthly_orders: Math.max(0, Math.floor(num(d.monthlyOrders))), wallet_available: num(d.walletAvailable), wallet_pending: num(d.walletPending), points_balance: Math.floor(num(d.pointsBalance)), ...common };
    case 'reseller_withdrawals':
      return { id, idempotency_key: d.idempotencyKey || `withdrawal:${id}`, user_id: String(d.userId || ''), amount: num(d.amount), method: d.method ?? null, status: d.status ?? null, ...common };
    case 'reseller_reward_ledger':
      return { id, user_id: String(d.userId || ''), order_id: d.orderId ?? id, reward_amount: num(d.rewardAmount), status: d.status ?? null, available_at: safe(d.availableAt) ?? null, ...common };
    case 'reseller_task_claims':
      return { id, user_id: String(d.userId || ''), task_id: String(d.taskId || ''), proof: d.proof ?? null, status: d.status ?? null, points: d.points == null ? null : Math.floor(num(d.points)), ...common };
    case 'reseller_point_ledger':
      return { id, user_id: String(d.userId || ''), claim_id: d.claimId ?? null, task_id: d.taskId ?? null, points: Math.floor(num(d.points)), reason: d.reason ?? null, status: d.status ?? null, ...common };
    case 'reseller_task_events':
      return { id, user_id: String(d.userId || ''), task_id: d.taskId ?? null, event: d.event ?? null, ...common };
    case 'reseller_whatsapp_orders':
      return { id, idempotency_key: d.idempotencyKey || `wa-order:${id}`, reseller_user_id: String(d.resellerUserId || d.userId || ''), reseller_code: d.resellerCode ?? null, customer: safe(d.customer || {}), items: safe(Array.isArray(d.items) ? d.items : []), subtotal: num(d.subtotal), delivery_charge: num(d.deliveryCharge), total: num(d.total), status: d.status ?? null, ...common };
    default:
      return null;
  }
}

export async function mirrorResellerFirestoreDoc(collection: string, id: string) {
  if (!id) return;
  const snap = await getAdminDb().collection(collection).doc(id).get();
  if (!snap.exists) return;
  const row = rowFor(collection, id, snap.data() || {});
  if (!row) return;
  const conflict = collection === 'reseller_profiles' ? 'user_id' : 'id';
  const result = await mirrorSupabaseUpsert({ table: collection, row, conflict });
  if (result.attempted && !result.ok) {
    console.error(`${collection}/${id} Supabase mirror failed`, result.error);
    await recordMirrorFailure(collection, id, 'upsert', row);
  }
}

export async function mirrorResellerDocAndProfile(collection: string, id: string) {
  const snap = await getAdminDb().collection(collection).doc(id).get();
  if (!snap.exists) return;
  await mirrorResellerFirestoreDoc(collection, id);
  const data = snap.data() || {};
  const userId = String(data.userId || data.resellerUserId || '');
  if (userId) await mirrorResellerFirestoreDoc('reseller_profiles', userId);
}
