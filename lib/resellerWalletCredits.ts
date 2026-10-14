import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mirrorResellerFirestoreDoc } from '@/lib/resellerDualMirror';

export type WalletCreditPurpose = 'shopping' | 'withdrawable';

export function exactRupees(amount: unknown): number {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Credit must be a positive whole amount in rupees.');
  }
  return amount;
}

export async function creditResellerWallet(input: {
  userId: string; amount: number; purpose: WalletCreditPurpose; reason: string; operationId: string;
}) {
  const { userId, purpose, reason, operationId } = input;
  const amount = exactRupees(input.amount);
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(userId)) throw new Error('Select a valid reseller UID.');
  if (purpose !== 'shopping' && purpose !== 'withdrawable') throw new Error('Select Shopping or Withdrawable.');
  if (!reason.trim() || reason.trim().length > 240) throw new Error('An audit reason (max 240 characters) is required.');
  if (!/^[0-9a-f-]{36}$/i.test(operationId)) throw new Error('Invalid credit operation ID.');

  const db = getAdminDb();
  const profileRef = db.collection('reseller_profiles').doc(userId);
  const entryRef = db.collection('reseller_wallet_credits').doc(operationId);
  const shoppingRef = db.collection('reseller_shopping_wallets').doc(userId);
  const result = await db.runTransaction(async tx => {
    const [profile, existing, shopping] = await Promise.all([tx.get(profileRef), tx.get(entryRef), tx.get(shoppingRef)]);
    if (existing.exists) {
      const old = existing.data() || {};
      if (old.userId !== userId || old.amount !== amount || old.purpose !== purpose) {
        throw new Error('Credit operation ID was already used for a different amount or member.');
      }
      return { credited: false, operationId, purpose, amount };
    }
    if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Active reseller profile not found.');
    const key = purpose === 'shopping' ? 'walletShopping' : 'walletAvailable';
    // The separate server-managed shopping wallet document is authoritative.
    // Never trust a profile field that could have been supplied at account creation.
    const prior = Number(purpose === 'shopping' ? shopping.data()?.balance || 0 : profile.data()?.[key] || 0);
    if (!Number.isSafeInteger(prior) || prior < 0 || !Number.isSafeInteger(prior + amount)) {
      throw new Error('Wallet would exceed the supported balance range.');
    }
    if (purpose === 'shopping') tx.set(shoppingRef, { userId, balance: prior + amount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(profileRef, { [key]: prior + amount, updatedAt: FieldValue.serverTimestamp() });
    tx.create(entryRef, {
      id: operationId, userId, amount, purpose, reason: reason.trim(),
      type: 'admin_credit', createdAt: FieldValue.serverTimestamp(),
    });
    return { credited: true, operationId, purpose, amount };
  });

  // The Firestore transaction is authoritative. Mirror the profile for Supabase-first admin reads.
  // If the mirror fails, the existing dual-write outbox records it for recovery.
  await mirrorResellerFirestoreDoc('reseller_profiles', userId);
  return result;
}
