import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getTierForMonthlyOrders } from '@/lib/resellerTiers';

const HOLD_DAYS = 7;
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export async function createPendingResellerReward(orderId: string) {
  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new Error('Order not found.');
  const order = orderSnap.data() || {};
  if (order.status !== 'delivered') throw new Error('Only delivered orders can earn reseller rewards.');
  const userId = typeof order.resellerUserId === 'string' ? order.resellerUserId : '';
  if (!userId) return { created: false, reason: 'Order is not linked to a reseller.' };

  const profileRef = db.collection('reseller_profiles').doc(userId);
  const ledgerRef = db.collection('reseller_reward_ledger').doc(orderId);
  return db.runTransaction(async tx => {
    const profileSnap = await tx.get(profileRef);
    const ledgerSnap = await tx.get(ledgerRef);
    if (!profileSnap.exists) throw new Error('Reseller profile not found.');
    if (ledgerSnap.exists) return { created: false, reason: 'Reward already recorded.' };
    const profile = profileSnap.data() || {};
    if (profile.status !== 'active') throw new Error('Reseller account is not active.');
    const monthlyOrders = Math.max(0, Math.floor(n(profile.monthlyOrders)));
    const tier = getTierForMonthlyOrders(monthlyOrders + 1);
    const baseAmount = Math.max(0, n(order.subtotal));
    if (!baseAmount) throw new Error('Order subtotal is invalid.');
    const rewardAmount = Math.round(baseAmount * tier.rewardPercent / 100);
    const deliveredAt = order.deliveredAt?.toDate?.() || order.updatedAt?.toDate?.() || new Date();
    const availableAt = new Date(deliveredAt.getTime() + HOLD_DAYS * 86400000);
    tx.create(ledgerRef, { id: orderId, userId, orderId, tierId: tier.id, rewardPercent: tier.rewardPercent, baseAmount, rewardAmount, status: 'pending', createdAt: FieldValue.serverTimestamp(), availableAt: Timestamp.fromDate(availableAt) });
    tx.update(profileRef, { monthlyOrders: monthlyOrders + 1, tierId: tier.id, updatedAt: FieldValue.serverTimestamp() });
    return { created: true, rewardAmount, tierId: tier.id, availableAt: availableAt.toISOString() };
  });
}

export async function releaseMaturedResellerRewards(userId?: string) {
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection('reseller_reward_ledger').where('status', '==', 'pending').where('availableAt', '<=', Timestamp.now());
  if (userId) query = query.where('userId', '==', userId);
  const snap = await query.get();
  let released = 0;
  for (const doc of snap.docs) {
    await db.runTransaction(async tx => {
      const ledger = await tx.get(doc.ref);
      if (!ledger.exists || ledger.data()?.status !== 'pending') return;
      const data = ledger.data() || {};
      const profileRef = db.collection('reseller_profiles').doc(String(data.userId));
      const profile = await tx.get(profileRef);
      if (!profile.exists) return;
      const amount = Math.max(0, n(data.rewardAmount));
      tx.update(doc.ref, { status: 'available', updatedAt: FieldValue.serverTimestamp() });
      tx.update(profileRef, { walletAvailable: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() });
      released++;
    });
  }
  return { released };
}

export async function createResellerWithdrawal(userId: string, amount: number, method: string, accountTitle: string, accountNumber: string) {
  if (!['easypaisa', 'jazzcash', 'bank'].includes(method)) throw new Error('Unsupported withdrawal method.');
  if (!Number.isInteger(amount) || amount < 500) throw new Error('Minimum withdrawal is Rs. 500.');
  if (!accountTitle.trim() || !accountNumber.trim()) throw new Error('Payout account details are required.');
  const db = getAdminDb(), profileRef = db.collection('reseller_profiles').doc(userId), withdrawalRef = db.collection('reseller_withdrawals').doc();
  await db.runTransaction(async tx => {
    const profile = await tx.get(profileRef);
    if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Active reseller profile not found.');
    const available = Math.max(0, Math.floor(n(profile.data()?.walletAvailable)));
    if (amount > available) throw new Error('Withdrawal amount exceeds available balance.');
    tx.update(profileRef, { walletAvailable: available - amount, updatedAt: FieldValue.serverTimestamp() });
    tx.create(withdrawalRef, { id: withdrawalRef.id, userId, amount, method, accountTitle: accountTitle.trim(), accountNumber: accountNumber.trim(), status: 'pending', createdAt: FieldValue.serverTimestamp() });
  });
  return { withdrawalId: withdrawalRef.id, status: 'pending' as const };
}

export async function reviewResellerWithdrawal(withdrawalId: string, action: 'approve' | 'reject' | 'paid', adminNote = '') {
  const db = getAdminDb(), ref = db.collection('reseller_withdrawals').doc(withdrawalId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Withdrawal request not found.');
    const data = snap.data() || {}, status = data.status, userId = String(data.userId || ''), amount = Math.max(0, n(data.amount));
    if (action === 'approve') {
      if (status !== 'pending') throw new Error('Only pending withdrawals can be approved.');
      tx.update(ref, { status: 'approved', reviewedAt: FieldValue.serverTimestamp(), adminNote: adminNote.trim() }); return;
    }
    if (action === 'paid') {
      if (status !== 'approved') throw new Error('Only approved withdrawals can be marked paid.');
      tx.update(ref, { status: 'paid', paidAt: FieldValue.serverTimestamp(), adminNote: adminNote.trim() }); return;
    }
    if (status !== 'pending' && status !== 'approved') throw new Error('This withdrawal cannot be rejected.');
    const profileRef = db.collection('reseller_profiles').doc(userId);
    if (!(await tx.get(profileRef)).exists) throw new Error('Reseller profile not found.');
    tx.update(profileRef, { walletAvailable: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() });
    tx.update(ref, { status: 'rejected', reviewedAt: FieldValue.serverTimestamp(), adminNote: adminNote.trim() });
  });
}
