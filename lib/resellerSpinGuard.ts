import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';

/** Browser-scoped anti-repeat gate, NOT a hardware identity/IMEI.
 * Shared first-party browser storage survives normal login/logout, so changing
 * Firebase accounts in the same browser does not reset today's wheel.
 * Clearing data, using another browser or reinstalling remains possible.
 */
export function spinKey(raw: string, day: string) {
  return createHash('sha256').update('primehub-spin-2026-v1|').update(day).update('|').update(raw).digest('hex');
}

export async function reserveDailySpin(owner: string, browserId: string, day: string) {
  if (!/^g_[A-Za-z0-9]{12,80}$/.test(browserId)) throw new Error('Browser reward session missing. Reload the page.');
  if (!owner || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid reward session.');
  const db = getAdminDb();
  const browser = db.collection('reseller_browser_daily_spins').doc(spinKey(browserId, day));
  const account = owner.startsWith('guest:')
    ? null : db.collection('reseller_account_daily_spins').doc(spinKey(owner, day));
  const token = randomUUID();
  await db.runTransaction(async tx => {
    const [br, ac] = await Promise.all([tx.get(browser), account ? tx.get(account) : Promise.resolve(null)]);
    const now = Date.now();
    const validate = (snap: FirebaseFirestore.DocumentSnapshot | null, label: string) => {
      if (!snap?.exists) return;
      const val = snap.data() || {};
      if (val.status === 'complete' || String(val.owner || '') !== owner)
        throw new Error(`This ${label} has already used today's spin.`);
      if (Number(val.reservedAt || 0) + 90_000 > now)
        throw new Error('A spin is still processing. Please try again shortly.');
    };
    validate(br, 'browser');
    validate(ac, 'account');
    const entry = {
      owner, status: 'processing', token,
      day, reservedAt: now, updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(browser, entry);
    if (account) tx.set(account, entry);
  });
  return async () => {
    try {
      await db.runTransaction(async tx => {
        const [br, ac] = await Promise.all([tx.get(browser), account ? tx.get(account) : Promise.resolve(null)]);
        if (br.data()?.token !== token || (ac && ac?.data()?.token !== token))
          throw new Error('Spin ownership changed.');
        const updated = { status: 'complete', completedAt: FieldValue.serverTimestamp() };
        tx.update(browser, updated);
        if (account) tx.update(account, updated);
      });
    } catch (error) {
      // A successful reward must NOT be issued a second time because a
      // noncritical marker could not be finalized; keep pending lock in place.
      console.error('Spin reward recorded; completion marker should be reconciled:', error);
    }
  };
}
