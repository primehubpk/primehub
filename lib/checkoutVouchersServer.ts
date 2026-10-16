import 'server-only';

import { getAdminDb } from '@/lib/firebaseAdmin';
import { getSupabasePrimaryPayload, isSupabaseWriteConfigured, mapDocumentToSupabase, recordMirrorFailure, supabasePrimaryUpsert } from '@/lib/dualWriteServer';

export type CheckoutVoucher = {
  id: string;
  code: string;
  kind: 'discount' | 'cash';
  amount: number;
  active: boolean;
  expiresAt?: string;
};

const DOCUMENT_ID = 'checkout_vouchers';

function normalizedCode(value: unknown): string {
  const valueString = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9_-]{4,24}$/.test(valueString) ? valueString : '';
}

export function voucherCode(value: unknown) {
  return normalizedCode(value);
}

export function cleanVoucher(value: unknown): CheckoutVoucher | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const code = normalizedCode(row.code);
  const amount = Number(row.amount);
  if (!code || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000) return null;
  if (row.kind !== 'discount' && row.kind !== 'cash') return null;
  const id = String(row.id || '').trim();
  if (!/^[A-Za-z0-9_-]{5,80}$/.test(id)) return null;
  const expiresAt = String(row.expiresAt || '').trim();
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return null;
  return { id, code, kind: row.kind, amount, active: row.active === true, ...(expiresAt ? { expiresAt } : {}) };
}

export async function listCheckoutVouchers(): Promise<CheckoutVoucher[]> {
  let payload: any;
  if (isSupabaseWriteConfigured()) {
    // Fail closed: never silently accept stale voucher settings when primary is unreachable.
    payload = await getSupabasePrimaryPayload('settings', DOCUMENT_ID);
  } else {
    const snap = await getAdminDb().collection('settings').doc(DOCUMENT_ID).get();
    payload = snap.exists ? snap.data() : null;
  }
  const vouchers = Array.isArray(payload?.vouchers) ? payload.vouchers : [];
  return vouchers.map(cleanVoucher).filter((v: CheckoutVoucher | null): v is CheckoutVoucher => v !== null);
}

export async function saveCheckoutVouchers(vouchers: CheckoutVoucher[]) {
  if (vouchers.length > 100) throw new Error('Only 100 vouchers can be configured.');
  const unique = new Set(vouchers.map(v => v.code));
  if (unique.size !== vouchers.length) throw new Error('Voucher codes must be unique.');
  const payload = { vouchers, updatedAt: new Date().toISOString() };
  if (isSupabaseWriteConfigured()) {
    const row = mapDocumentToSupabase('settings', DOCUMENT_ID, payload, 'supabase');
    if (!row) throw new Error('Cannot save vouchers.');
    await supabasePrimaryUpsert({ table: 'settings', row: { ...row, authoritative_source: 'supabase' } });
    try { await getAdminDb().collection('settings').doc(DOCUMENT_ID).set(payload); }
    catch (error) {
      console.error('Voucher setting Firebase mirror deferred', error);
      try { await recordMirrorFailure('settings', DOCUMENT_ID, 'upsert', payload, 'firebase'); } catch {}
    }
  } else {
    await getAdminDb().collection('settings').doc(DOCUMENT_ID).set(payload);
  }
}

export function resolveCheckoutVoucher(vouchers: CheckoutVoucher[], value: unknown, eligibleSubtotal: number) {
  const code = normalizedCode(value);
  if (!code) return null;
  const voucher = vouchers.find(v => v.code === code && v.active);
  if (!voucher) throw new Error('Voucher code is invalid or inactive.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (voucher.expiresAt && voucher.expiresAt < today) throw new Error('Voucher has expired.');
  if (eligibleSubtotal <= 0) throw new Error('This voucher is not applicable to Big Deal or Weekly Deal products.');
  const amount = Math.min(voucher.amount, eligibleSubtotal);
  return { id: voucher.id, code: voucher.code, kind: voucher.kind, amount };
}
