import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';

const TIERS = [
  { id: 'elite', minMonthlyOrders: 30, rewardPercent: 20 },
  { id: 'pro', minMonthlyOrders: 20, rewardPercent: 15 },
  { id: 'prime', minMonthlyOrders: 10, rewardPercent: 10 },
  { id: 'starter', minMonthlyOrders: 0, rewardPercent: 5 },
] as const;

function tierFor(monthlyOrders: number) {
  return TIERS.find(tier => monthlyOrders >= tier.minMonthlyOrders) || TIERS[TIERS.length - 1];
}

export async function approveResellerReward(params: { resellerUserId: string; orderId: string; orderTotal: number; source: string }) {
  const db = getAdminDb();
  const profileRef = db.collection('reseller_profiles').doc(params.resellerUserId);
  const shoppingRef = db.collection('reseller_shopping_wallets').doc(params.resellerUserId);
  const rewardRef = db.collection('reseller_rewards').doc(params.orderId);
  const orderRef = db.collection('orders').doc(params.orderId);
  return db.runTransaction(async tx => {
    const [profileSnap, shoppingSnap, rewardSnap, orderSnap] = await Promise.all([
      tx.get(profileRef), tx.get(shoppingRef), tx.get(rewardRef), tx.get(orderRef),
    ]);
    if (!profileSnap.exists) throw new Error('Reseller profile not found.');
    if (rewardSnap.exists) return { alreadyCredited: true, reward: Number(rewardSnap.data()?.amount || 0) };
    if (!orderSnap.exists && params.source === 'website') throw new Error('Order not found.');
    const profile = profileSnap.data() || {};
    const currentMonthlyOrders = Number(profile.monthlyOrders || 0);
    const tier = tierFor(currentMonthlyOrders);
    const reward = Math.round(Math.max(0, Number(params.orderTotal || 0)) * tier.rewardPercent / 100);
    if (!Number.isSafeInteger(reward) || reward <= 0) throw new Error('Order total is not eligible for a reward.');
    const available = Number(shoppingSnap.data()?.balance || 0);
    if (!Number.isSafeInteger(available) || available < 0 || !Number.isSafeInteger(available + reward)) {
      throw new Error('Invalid shopping rewards balance.');
    }
    tx.create(rewardRef, {
      resellerUserId: params.resellerUserId, orderId: params.orderId, source: params.source,
      amount: reward, rewardPercent: tier.rewardPercent, tierId: tier.id,
      rewardSettlementMode: 'shopping_only_v1', status: 'approved',
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(shoppingRef, { userId: params.resellerUserId, balance: available + reward,
      updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(profileRef, { monthlyOrders: currentMonthlyOrders + 1,
      walletShopping: available + reward, updatedAt: FieldValue.serverTimestamp() });
    if (orderSnap.exists) tx.update(orderRef, {
      resellerRewardStatus: 'credited', resellerReward: reward,
      resellerRewardTier: tier.id, resellerRewardPercent: tier.rewardPercent,
    });
    return { alreadyCredited: false, reward, tierId: tier.id, rewardPercent: tier.rewardPercent };
  });
}
