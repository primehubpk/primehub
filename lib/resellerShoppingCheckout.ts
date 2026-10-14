import 'server-only';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mirrorResellerFirestoreDoc } from '@/lib/resellerDualMirror';

export function allocateShoppingCash(shopping: number, withdrawable: number, total: number) {
  if (![shopping, withdrawable, total, shopping + withdrawable].every(n => Number.isSafeInteger(n) && n >= 0) || total <= 0) {
    throw new Error('Invalid shopping cash allocation.');
  }
  const shoppingApplied = Math.min(shopping, total);
  const withdrawableApplied = Math.min(withdrawable, total - shoppingApplied);
  return { shoppingApplied, withdrawableApplied, amount: shoppingApplied + withdrawableApplied,
    amountDue: total - shoppingApplied - withdrawableApplied };
}

export function walletOrderFingerprint(data: Record<string, any>) {
  return createHash('sha256').update(JSON.stringify({
    customer: data.customer, items: data.items, subtotal: data.subtotal,
    deliveryCharge: data.deliveryCharge, total: data.total,
    selfCollect: data.selfCollect, resellerUserId: data.resellerUserId,
  })).digest('hex');
}

export async function shoppingWalletBalance(userId: string) {
  const db = getAdminDb();
  const [snap, wallet] = await Promise.all([db.collection('reseller_profiles').doc(userId).get(), db.collection('reseller_shopping_wallets').doc(userId).get()]);
  if (!snap.exists || snap.data()?.status !== 'active') return 0;
  const shopping = Number(wallet.data()?.balance || 0);
  const withdrawable = Number(snap.data()?.walletAvailable || 0);
  if (![shopping, withdrawable, shopping + withdrawable].every(value => Number.isSafeInteger(value) && value >= 0)) return 0;
  // Cash rewards can be used for shopping OR withdrawn; shopping-only credits
  // can ONLY be spent in the store. Do not double count either balance.
  return shopping + withdrawable;
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
  const walletRef = db.collection('reseller_shopping_wallets').doc(userId);
  const fingerprint = walletOrderFingerprint(orderData);
  const result = await db.runTransaction(async tx => {
    const [profile, order, priorSpend, wallet] = await Promise.all([tx.get(profileRef), tx.get(orderRef), tx.get(spendRef), tx.get(walletRef)]);
    if (order.exists || priorSpend.exists) {
      const old = order.data() || {};
      if (!order.exists || !priorSpend.exists || old.resellerUserId !== userId || old.walletFingerprint !== fingerprint) {
        throw new Error('Checkout operation ID already used.');
      }
      return { created: false, amount: Number(old.walletShoppingApplied || 0), amountDue: Number(old.amountDue || 0), order: old };
    }
    if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Active reseller profile required to use wallet credit.');
    const shopping = Number(wallet.data()?.balance || 0);
    const withdrawable = Number(profile.data()?.walletAvailable || 0);
    if (![shopping, withdrawable, shopping + withdrawable].every(n => Number.isSafeInteger(n) && n >= 0)) {
      throw new Error('Invalid reseller cash wallet balances.');
    }
    if (shopping + withdrawable <= 0) throw new Error('There is no cash available to spend.');
    // First use restricted shopping cash. Only then spend withdrawable rewards.
    // Both balances are decremented atomically with the actual order creation.
    const { shoppingApplied, withdrawableApplied, amount, amountDue } =
      allocateShoppingCash(shopping, withdrawable, orderData.total);
    const savedOrder = {
      ...orderData, resellerUserId: userId, walletFingerprint: fingerprint,
      walletShoppingApplied: amount, walletShoppingOnlyApplied: shoppingApplied,
      walletWithdrawalApplied: withdrawableApplied, amountDue,
      paymentMethod: amountDue === 0 ? 'shopping_wallet' : 'shopping_wallet_plus_cod',
      walletPaymentStatus: 'applied',
    };
    if (shoppingApplied > 0) tx.update(walletRef, { balance: shopping - shoppingApplied, updatedAt: FieldValue.serverTimestamp() });
    tx.update(profileRef, {
      walletShopping: shopping - shoppingApplied, walletAvailable: withdrawable - withdrawableApplied,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(orderRef, savedOrder);
    tx.create(spendRef, { id: orderId, userId, orderId, amount, shoppingApplied, withdrawableApplied, type: 'shopping_order', status: 'applied', createdAt: FieldValue.serverTimestamp() });
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
    const walletRef = db.collection('reseller_shopping_wallets').doc(userId);
    const [profile, wallet] = await Promise.all([tx.get(profileRef), tx.get(walletRef)]);
    if (!profile.exists) throw new Error('Reseller wallet owner not found.');
    const shopping = Number(wallet.data()?.balance || 0);
    const withdrawable = Number(profile.data()?.walletAvailable || 0);
    const shoppingRefund = Number(spend.data()?.shoppingApplied ?? amount);
    const withdrawRefund = Number(spend.data()?.withdrawableApplied ?? 0);
    if (![shopping, withdrawable, shoppingRefund, withdrawRefund, shopping + shoppingRefund, withdrawable + withdrawRefund]
      .every(n => Number.isSafeInteger(n) && n >= 0) || shoppingRefund + withdrawRefund !== amount) {
      throw new Error('Wallet refund ledger is inconsistent.');
    }
    const updated = { ...oldOrder, status: 'cancelled', walletPaymentStatus: 'refunded', updatedAt: new Date().toISOString() };
    if (shoppingRefund > 0) {
      if (!wallet.exists) throw new Error('Shopping balance record is missing; manual refund review required.');
      tx.update(walletRef, { balance: shopping + shoppingRefund, updatedAt: FieldValue.serverTimestamp() });
    }
    tx.update(profileRef, {
      walletShopping: shopping + shoppingRefund,
      walletAvailable: withdrawable + withdrawRefund,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(orderRef, { status: 'cancelled', walletPaymentStatus: 'refunded', updatedAt: FieldValue.serverTimestamp() });
    tx.update(spendRef, { status: 'refunded', refundedAt: FieldValue.serverTimestamp() });
    tx.create(db.collection('reseller_wallet_refunds').doc(orderId), { id: orderId, userId, amount, shoppingRefund, withdrawRefund, orderId, type: 'order_cancellation', createdAt: FieldValue.serverTimestamp() });
    return { applied: true, order: updated, userId };
  });
  if (refunded.applied) {
    try { await mirrorResellerFirestoreDoc('reseller_profiles', refunded.userId); }
    catch (error) { console.error('Refund mirror deferred:', error); }
  }
  return refunded;
}
