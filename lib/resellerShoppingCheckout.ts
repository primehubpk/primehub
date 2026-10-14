import 'server-only';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mirrorResellerFirestoreDoc } from '@/lib/resellerDualMirror';

export function walletOrderFingerprint(data: Record<string, any>) {
  return createHash('sha256').update(JSON.stringify({
    customer: data.customer, items: data.items, subtotal: data.subtotal,
    deliveryCharge: data.deliveryCharge, total: data.total,
    selfCollect: data.selfCollect, resellerUserId: data.resellerUserId,
  })).digest('hex');
}

export async function shoppingWalletBalance(userId: string) {
  const snap = await getAdminDb().collection('reseller_profiles').doc(userId).get();
  if (!snap.exists || snap.data()?.status !== 'active') return 0;
  const amount = Number(snap.data()?.walletShopping || 0);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

/** Creates both the order and the wallet deduction in one Firestore transaction.
 * A repeated request with the same order ID is idempotent and NEVER debits twice.
 */
export async function createShoppingWalletOrder(userId: string, orderId: string, orderData: Record<string, any>) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new Error('Invalid checkout operation ID.');
  if (!userId || !Number.isSafeInteger(orderData.total) || orderData.total <= 0) {
    throw new Error('Invalid reseller wallet checkout.');
  }
  const db = getAdminDb();
  const profileRef = db.collection('reseller_profiles').doc(userId);
  const orderRef = db.collection('orders').doc(orderId);
  const spendRef = db.collection('reseller_wallet_spends').doc(orderId);
  const fingerprint = walletOrderFingerprint(orderData);
  const result = await db.runTransaction(async tx => {
    const [profile, order, priorSpend] = await Promise.all([tx.get(profileRef), tx.get(orderRef), tx.get(spendRef)]);
    if (order.exists || priorSpend.exists) {
      const old = order.data() || {};
      if (!order.exists || !priorSpend.exists || old.resellerUserId !== userId || old.walletFingerprint !== fingerprint) {
        throw new Error('Checkout operation ID already used.');
      }
      return { created: false, amount: Number(old.walletShoppingApplied || 0), amountDue: Number(old.amountDue || 0), order: old };
    }
    if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Active reseller profile required to use wallet credit.');
    const available = Number(profile.data()?.walletShopping || 0);
    if (!Number.isSafeInteger(available) || available <= 0) throw new Error('Shopping wallet credit is unavailable.');
    const amount = Math.min(available, orderData.total);
    const amountDue = orderData.total - amount;
    const savedOrder = {
      ...orderData, resellerUserId: userId, walletFingerprint: fingerprint,
      walletShoppingApplied: amount, amountDue,
      paymentMethod: amountDue === 0 ? 'shopping_wallet' : 'shopping_wallet_plus_cod',
      walletPaymentStatus: 'applied',
    };
    tx.update(profileRef, { walletShopping: available - amount, updatedAt: FieldValue.serverTimestamp() });
    tx.create(orderRef, savedOrder);
    tx.create(spendRef, { id: orderId, userId, orderId, amount, type: 'shopping_order', status: 'applied', createdAt: FieldValue.serverTimestamp() });
    return { created: true, amount, amountDue, order: savedOrder };
  });
  if (result.created) {
    // This mirror is recovery-friendly: a failure queues a retry without undoing a paid order.
    try { await mirrorResellerFirestoreDoc('reseller_profiles', userId); }
    catch (error) { console.error('Wallet profile mirror deferred:', error); }
  }
  return result;
}

/** Refunds wallet-funded order at most once, and marks the order cancelled atomically.
 * Never auto-refund a shipped or delivered order; those require manual investigation.
 */
export async function refundShoppingWalletOrder(orderId: string) {
  const db = getAdminDb();
  const spendRef = db.collection('reseller_wallet_spends').doc(orderId);
  const orderRef = db.collection('orders').doc(orderId);
  const refunded = await db.runTransaction(async tx => {
    const [spend, order] = await Promise.all([tx.get(spendRef), tx.get(orderRef)]);
    if (!spend.exists || !order.exists) throw new Error('Shopping wallet order not found.');
    if (spend.data()?.status === 'refunded') return { applied: false, order: order.data() || {}, userId: String(spend.data()?.userId || '') };
    if (spend.data()?.status !== 'applied') throw new Error('Unrecognized wallet spend state.');
    const oldOrder = order.data() || {};
    if (['delivered', 'shipped'].includes(String(oldOrder.status || ''))) {
      throw new Error('Shipped/delivered wallet orders need manual refund review.');
    }
    const userId = String(spend.data()?.userId || '');
    const amount = Number(spend.data()?.amount || 0);
    if (!userId || !Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid wallet spend.');
    const profileRef = db.collection('reseller_profiles').doc(userId);
    const profile = await tx.get(profileRef);
    if (!profile.exists) throw new Error('Reseller wallet owner not found.');
    const available = Number(profile.data()?.walletShopping || 0);
    if (!Number.isSafeInteger(available) || !Number.isSafeInteger(available + amount)) throw new Error('Invalid wallet refund balance.');
    const updated = { ...oldOrder, status: 'cancelled', walletPaymentStatus: 'refunded', updatedAt: new Date().toISOString() };
    tx.update(profileRef, { walletShopping: available + amount, updatedAt: FieldValue.serverTimestamp() });
    tx.update(orderRef, { status: 'cancelled', walletPaymentStatus: 'refunded', updatedAt: FieldValue.serverTimestamp() });
    tx.update(spendRef, { status: 'refunded', refundedAt: FieldValue.serverTimestamp() });
    tx.create(db.collection('reseller_wallet_refunds').doc(orderId), { id: orderId, userId, amount, orderId, type: 'order_cancellation', createdAt: FieldValue.serverTimestamp() });
    return { applied: true, order: updated, userId };
  });
  if (refunded.applied) {
    try { await mirrorResellerFirestoreDoc('reseller_profiles', refunded.userId); }
    catch (error) { console.error('Refund mirror deferred:', error); }
  }
  return refunded;
}
