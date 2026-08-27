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
  const rewardRef = db.collection('reseller_rewards').doc(params.orderId);
  const orderRef = db.collection('orders').doc(params.orderId);
  const [profileSnap, rewardSnap, orderSnap] = await Promise.all([profileRef.get(), rewardRef.get(), orderRef.get()]);
  if (!profileSnap.exists) throw new Error('Reseller profile not found.');
  if (rewardSnap.exists) return { alreadyCredited: true, reward: Number(rewardSnap.data()?.amount || 0) };
  if (!orderSnap.exists && params.source === 'website') throw new Error('Order not found.');

  const profile = profileSnap.data() || {};
  const currentMonthlyOrders = Number(profile.monthlyOrders || 0);
  const tier = tierFor(currentMonthlyOrders);
  const orderTotal = Math.max(0, Number(params.orderTotal || 0));
  const reward = Math.round(orderTotal * tier.rewardPercent / 100);
  if (reward <= 0) throw new Error('Order total is not eligible for a reward.');

  const batch = db.batch();
  batch.set(rewardRef, {
    resellerUserId: params.resellerUserId,
    orderId: params.orderId,
    source: params.source,
    amount: reward,
    rewardPercent: tier.rewardPercent,
    tierId: tier.id,
    status: 'approved',
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.update(profileRef, {
    monthlyOrders: currentMonthlyOrders + 1,
    walletAvailable: Number(profile.walletAvailable || 0) + reward,
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (orderSnap.exists) batch.update(orderRef, { resellerRewardStatus: 'credited', resellerReward: reward, resellerRewardTier: tier.id, resellerRewardPercent: tier.rewardPercent });
  await batch.commit();
  return { alreadyCredited: false, reward, tierId: tier.id, rewardPercent: tier.rewardPercent };
}
