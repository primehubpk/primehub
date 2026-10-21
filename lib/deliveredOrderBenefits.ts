import 'server-only';

import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { cashBackForTier } from '@/lib/orderBenefits';
import { mirrorResellerFirestoreDoc } from '@/lib/resellerDualMirror';
import { referralCode } from '@/lib/primeFamilyReferralsServer';

/** Only the actual Admin Delivered status transition can invoke this function.
 * Every credit, order ledger and wallet update commits atomically in Firestore.
 * A retry with the same orderId never pays a second time.
 */
export async function creditDeliveredOrderBenefits(orderId: string, authoritativeOrder: Record<string, any>) {
  const userId = String(authoritativeOrder.resellerUserId || '').trim();
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(userId)) {
    throw new Error('A valid linked Prime Family account is required for cashback.');
  }
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(orderId)) throw new Error('Invalid verified order ID.');
  if (authoritativeOrder.cashbackPolicy !== 'delivered_only_v1' ||
    !['website', 'salar'].includes(String(authoritativeOrder.source || 'website'))) {
    throw new Error('Legacy orders are not eligible for automatic cashback.');
  }
  if (authoritativeOrder.isRealOrder === false || authoritativeOrder.status === 'cancelled' ||
    authoritativeOrder.status === 'refunded' || authoritativeOrder.whatsappState === 'awaiting_message') {
    throw new Error('Only a genuine, uncancelled checkout order can earn cashback.');
  }
  const eligible = Number(authoritativeOrder.eligibleAfterVoucher);
  const percent = Number(authoritativeOrder.cashbackPercent);
  const due = Number(authoritativeOrder.total);
  if (!Number.isSafeInteger(eligible) || eligible < 0 || !Number.isSafeInteger(due) || due < 0 ||
      eligible > due || !Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Invalid verified order cashback snapshot.');
  }
  // Keep legacy pending voucher orders' original snapshots unchanged.
  const isReferral = authoritativeOrder.voucherRewardMode === 'exclusive_v1' &&
    authoritativeOrder.voucherKind === 'referral';
  const referralOwnerUid = isReferral ? String(authoritativeOrder.referralOwnerUid || '') : '';
  const referralPercent = isReferral ? Number(authoritativeOrder.referralPercent) : 0;
  const referralCodeValue = isReferral ? referralCode(authoritativeOrder.voucherCode) : '';
  if (isReferral && (!referralCodeValue || !/^[A-Za-z0-9_-]{20,128}$/.test(referralOwnerUid) ||
    referralOwnerUid === userId || !Number.isSafeInteger(referralPercent) ||
    referralPercent < 1 || referralPercent > 20 ||
    Number(authoritativeOrder.referralCashEstimate) !== cashBackForTier(eligible, referralPercent))) {
    throw new Error('Invalid referral reward snapshot.');
  }
  const exclusiveVoucher = authoritativeOrder.voucherRewardMode === 'exclusive_v1' &&
    ['cash', 'cashback', 'referral'].includes(String(authoritativeOrder.voucherKind || ''));
  const tierCash = exclusiveVoucher ? 0 : cashBackForTier(eligible, percent);
  const voucherCash = ['cash', 'cashback'].includes(String(authoritativeOrder.voucherKind || ''))
    ? Number(authoritativeOrder.voucherCashAmount || 0) : 0;
  if (!Number.isSafeInteger(voucherCash) || voucherCash < 0 || voucherCash > eligible) {
    throw new Error('Invalid order voucher snapshot.');
  }
  const voucherCode = String(authoritativeOrder.voucherCode || '');
  if (voucherCash > 0 && !/^[A-Z0-9_-]{4,24}$/.test(voucherCode)) throw new Error('Invalid cash voucher.');
  if (authoritativeOrder.voucherKind === 'cashback') {
    const voucherPercent = Number(authoritativeOrder.voucherCashbackPercent);
    if (!Number.isSafeInteger(voucherPercent) || voucherPercent < 1 || voucherPercent > 100 ||
        voucherCash !== cashBackForTier(eligible, voucherPercent) || !exclusiveVoucher) {
      throw new Error('Invalid cashback voucher percentage.');
    }
  }
  const db = getAdminDb(), profileRef = db.collection('reseller_profiles').doc(userId);
  const creditRef = db.collection('reseller_rewards').doc(orderId);
  const orderRef = db.collection('orders').doc(orderId);
  const claimId = voucherCash > 0
    ? createHash('sha256').update(userId + ':' + voucherCode).digest('hex') : '';
  const voucherClaimRef = claimId ? db.collection('reseller_voucher_claims').doc(claimId) : null;
  const referralOwnerRef = isReferral ? db.collection('reseller_profiles').doc(referralOwnerUid) : null;
  const referralCodeRef = isReferral ? db.collection('reseller_referral_codes').doc(referralCodeValue) : null;
  const referralCreditRef = isReferral ? db.collection('reseller_referral_credits').doc(orderId) : null;

  const result = await db.runTransaction(async tx => {
    const [profileSnap, priorCredit, orderSnap, priorVoucher, referralOwner, referralMapping] = await Promise.all([
      tx.get(profileRef), tx.get(creditRef), tx.get(orderRef),
      voucherClaimRef ? tx.get(voucherClaimRef) : Promise.resolve(null),
      referralOwnerRef ? tx.get(referralOwnerRef) : Promise.resolve(null),
      referralCodeRef ? tx.get(referralCodeRef) : Promise.resolve(null),
    ]);
    if (priorCredit.exists) {
      const recorded = priorCredit.data() || {};
      if (recorded.resellerUserId !== userId) throw new Error('Reward ledger ownership mismatch.');
      return { alreadyCredited: true, reward: Number(recorded.amount || 0),
        cashback: Number(recorded.cashback || 0), voucherCash: Number(recorded.voucherCash || 0),
        referralCash: Number(recorded.referralCash || 0) };
    }
    if (!profileSnap.exists || profileSnap.data()?.status !== 'active') {
      throw new Error('Linked reseller profile is not active. No cash has been credited.');
    }
    if (orderSnap.exists && ['cancelled', 'refunded'].includes(String(orderSnap.data()?.status || ''))) {
      throw new Error('Cancelled orders cannot receive cashback.');
    }
    const profile = profileSnap.data() || {};
    const existingCash = Number(profile.walletAvailable || 0);
    const monthlyOrders = Number(profile.monthlyOrders || 0);
    if (![existingCash, monthlyOrders].every(x => Number.isSafeInteger(x) && x >= 0)) {
      throw new Error('Invalid existing reseller wallet balance.');
    }
    if (isReferral && (!referralMapping?.exists ||
      referralMapping.data()?.ownerUid !== referralOwnerUid ||
      referralMapping.data()?.code !== referralCodeValue)) {
      throw new Error('Referral ownership mismatch. No reward will be issued.');
    }
    // Every qualifying Delivered order may reward the inviter once.
    // The order-keyed reseller_rewards ledger prevents duplicate credit.
    const referralPayable = isReferral &&
      referralOwner?.exists && referralOwner.data()?.status === 'active'
      ? cashBackForTier(eligible, referralPercent) : 0;
    const referralExisting = Number(referralOwner?.data()?.walletAvailable ?? 0);
    if (isReferral && (!Number.isSafeInteger(referralExisting) || referralExisting < 0 ||
      !Number.isSafeInteger(referralExisting + referralPayable))) {
      throw new Error('Invalid inviter wallet balance.');
    }
    // A cash voucher can pay each real member once. Cashback still pays on
    // subsequent legitimate delivered orders if a cash code is reused.
    const voucherAwarded = voucherClaimRef && !priorVoucher?.exists
      ? Math.min(voucherCash, Math.max(0, eligible - tierCash)) : 0;
    const reward = tierCash + voucherAwarded;
    if (!Number.isSafeInteger(existingCash + reward)) throw new Error('Wallet limit exceeded.');
    tx.update(profileRef, {
      walletAvailable: existingCash + reward, monthlyOrders: monthlyOrders + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(creditRef, {
      resellerUserId: userId, orderId, amount: reward, cashback: tierCash,
      voucherCash: voucherAwarded, referralCash: referralPayable,
      referralOwnerUid: isReferral ? referralOwnerUid : '',
      rewardPercent: percent,
      tierId: String(authoritativeOrder.resellerTier || ''),
      status: 'approved', source: 'admin_delivered', createdAt: FieldValue.serverTimestamp(),
    });
    if (voucherClaimRef && voucherAwarded > 0) {
      tx.create(voucherClaimRef, {
        userId, orderId, code: voucherCode, amount: voucherAwarded,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (referralPayable > 0 && referralOwnerRef && referralCreditRef) {
      tx.update(referralOwnerRef, {
        walletAvailable: referralExisting + referralPayable,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(referralCreditRef, {
        ownerUid: referralOwnerUid, buyerUid: userId, code: referralCodeValue,
        orderId, amount: referralPayable, percent: referralPercent,
        eligibleSubtotal: eligible, source: 'verified_delivered_order',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    // Mirror locally, even if the normal order was Supabase-primary and its
    // earlier Firestore mirror was unavailable. Do not replace existing items.
    tx.set(orderRef, {
      ...(orderSnap.exists ? {} : { ...authoritativeOrder }),
      status: 'delivered', resellerRewardStatus: 'credited',
      resellerReward: reward, resellerCashback: tierCash,
      voucherCashCredited: voucherAwarded, referralCashCredited: referralPayable,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { alreadyCredited: false, reward, cashback: tierCash, voucherCash: voucherAwarded, referralCash: referralPayable };
  });

  try { await mirrorResellerFirestoreDoc('reseller_profiles', userId); }
  catch (error) { console.error('Delivered cashback wallet mirror deferred', error); }
  if (isReferral && result.referralCash > 0) {
    try { await mirrorResellerFirestoreDoc('reseller_profiles', referralOwnerUid); }
    catch (error) { console.error('Referral inviter wallet mirror deferred', error); }
  }
  return result;
}
