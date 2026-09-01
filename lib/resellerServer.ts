import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getTierForMonthlyOrders } from '@/lib/resellerTiers';
import { DEFAULT_RESELLER_TASKS } from '@/lib/resellerTasks';

const HOLD_DAYS = 7;
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export async function createPendingResellerReward(orderId: string) {
  const db = getAdminDb(), orderRef = db.collection('orders').doc(orderId), orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new Error('Order not found.');
  const order = orderSnap.data() || {};
  if (order.status !== 'delivered') throw new Error('Only delivered orders can earn reseller rewards.');
  const userId = typeof order.resellerUserId === 'string' ? order.resellerUserId : '';
  if (!userId) return { created: false, reason: 'Order is not linked to a reseller.' };
  const profileRef = db.collection('reseller_profiles').doc(userId), ledgerRef = db.collection('reseller_reward_ledger').doc(orderId);
  return db.runTransaction(async tx => {
    const profileSnap = await tx.get(profileRef), ledgerSnap = await tx.get(ledgerRef);
    if (!profileSnap.exists) throw new Error('Reseller profile not found.');
    if (ledgerSnap.exists) return { created: false, reason: 'Reward already recorded.' };
    const profile = profileSnap.data() || {};
    if (profile.status !== 'active') throw new Error('Reseller account is not active.');
    const monthlyOrders = Math.max(0, Math.floor(n(profile.monthlyOrders))), tier = getTierForMonthlyOrders(monthlyOrders + 1), baseAmount = Math.max(0, n(order.subtotal));
    if (!baseAmount) throw new Error('Order subtotal is invalid.');
    const rewardAmount = Math.round(baseAmount * tier.rewardPercent / 100), deliveredAt = order.deliveredAt?.toDate?.() || order.updatedAt?.toDate?.() || new Date(), availableAt = new Date(deliveredAt.getTime() + HOLD_DAYS * 86400000);
    tx.create(ledgerRef, { id: orderId, userId, orderId, tierId: tier.id, rewardPercent: tier.rewardPercent, baseAmount, rewardAmount, status: 'pending', createdAt: FieldValue.serverTimestamp(), availableAt: Timestamp.fromDate(availableAt) });
    tx.update(profileRef, { monthlyOrders: monthlyOrders + 1, tierId: tier.id, updatedAt: FieldValue.serverTimestamp() });
    return { created: true, rewardAmount, tierId: tier.id, availableAt: availableAt.toISOString() };
  });
}

export async function releaseMaturedResellerRewards(userId?: string) {
  const db = getAdminDb(), snap = await db.collection('reseller_reward_ledger').where('status', '==', 'pending').where('availableAt', '<=', Timestamp.now()).get();
  let released = 0;
  for (const doc of snap.docs) {
    if (userId && doc.data()?.userId !== userId) continue;
    await db.runTransaction(async tx => {
      const ledger = await tx.get(doc.ref);
      if (!ledger.exists || ledger.data()?.status !== 'pending') return;
      const data = ledger.data() || {}, profileRef = db.collection('reseller_profiles').doc(String(data.userId)), profile = await tx.get(profileRef);
      if (!profile.exists) return;
      const amount = Math.max(0, n(data.rewardAmount));
      tx.update(doc.ref, { status: 'available', updatedAt: FieldValue.serverTimestamp() });
      tx.update(profileRef, { walletAvailable: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() });
      released++;
    });
  }
  return { released };
}

export async function createResellerWithdrawal(userId: string, amount: number, method: string, accountTitle: string, accountNumber: string, bankName = '') {
  if (!['easypaisa', 'jazzcash', 'bank'].includes(method)) throw new Error('Unsupported withdrawal method.');
  if (!Number.isInteger(amount) || amount < 500) throw new Error('Minimum withdrawal is Rs. 500.');
  if (!accountTitle.trim() || !accountNumber.trim()) throw new Error('Payout account details are required.');
  if (method === 'bank' && !bankName.trim()) throw new Error('Bank name is required.');
  const db = getAdminDb(), profileRef = db.collection('reseller_profiles').doc(userId), withdrawalRef = db.collection('reseller_withdrawals').doc();
  await db.runTransaction(async tx => {
    const profile = await tx.get(profileRef);
    if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Active reseller profile not found.');
    const available = Math.max(0, Math.floor(n(profile.data()?.walletAvailable)));
    if (amount > available) throw new Error('Withdrawal amount exceeds available balance.');
    tx.update(profileRef, { walletAvailable: available - amount, updatedAt: FieldValue.serverTimestamp() });
    tx.create(withdrawalRef, { id: withdrawalRef.id, userId, amount, method, bankName: method === 'bank' ? bankName.trim() : '', accountTitle: accountTitle.trim(), accountNumber: accountNumber.trim(), status: 'pending', createdAt: FieldValue.serverTimestamp() });
  });
  return { withdrawalId: withdrawalRef.id, status: 'pending' as const };
}

export async function reviewResellerWithdrawal(withdrawalId: string, action: 'approve' | 'reject' | 'paid', adminNote = '') {
  const db = getAdminDb(), ref = db.collection('reseller_withdrawals').doc(withdrawalId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Withdrawal request not found.');
    const data = snap.data() || {}, status = data.status, userId = String(data.userId || ''), amount = Math.max(0, n(data.amount));
    if (action === 'approve') { if (status !== 'pending') throw new Error('Only pending withdrawals can be approved.'); tx.update(ref, { status: 'approved', reviewedAt: FieldValue.serverTimestamp(), adminNote: adminNote.trim() }); return; }
    if (action === 'paid') { if (status !== 'approved') throw new Error('Only approved withdrawals can be marked paid.'); tx.update(ref, { status: 'paid', paidAt: FieldValue.serverTimestamp(), adminNote: adminNote.trim() }); return; }
    if (status !== 'pending' && status !== 'approved') throw new Error('This withdrawal cannot be rejected.');
    const profileRef = db.collection('reseller_profiles').doc(userId);
    if (!(await tx.get(profileRef)).exists) throw new Error('Reseller profile not found.');
    tx.update(profileRef, { walletAvailable: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() });
    tx.update(ref, { status: 'rejected', reviewedAt: FieldValue.serverTimestamp(), adminNote: adminNote.trim() });
  });
}



export async function createResellerTaskClaim(userId: string, taskId: string, proof: string) {
  const cleanTask = taskId.trim().toLowerCase();
  const cleanProof = proof.trim();
  if (!cleanTask || cleanTask.length > 80 || !['youtube', 'instagram', 'tiktok'].includes(cleanTask)) throw new Error('Proof is only needed for YouTube, Instagram, or TikTok.');
  if (cleanProof.length < 3 || cleanProof.length > 1000) throw new Error('Please provide your account name or proof link.');
  const db = getAdminDb();
  const profile = await db.collection('reseller_profiles').doc(userId).get();
  if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Join the Reseller Club before submitting a task.');
  const duplicate = await db.collection('reseller_task_claims').where('userId', '==', userId).where('taskId', '==', cleanTask).where('status', 'in', ['pending', 'approved']).limit(1).get();
  if (!duplicate.empty) throw new Error('This task is already submitted or approved.');
  const ref = db.collection('reseller_task_claims').doc();
  await ref.create({ id: ref.id, userId, taskId: cleanTask, proof: cleanProof, status: 'pending', createdAt: FieldValue.serverTimestamp() });
  return { claimId: ref.id, status: 'pending' as const };
}

export async function reviewResellerTaskClaim(claimId: string, action: 'approve' | 'reject', adminNote = '') {
  const db = getAdminDb(), claimRef = db.collection('reseller_task_claims').doc(claimId);
  await db.runTransaction(async tx => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) throw new Error('Task claim not found.');
    const claim = claimSnap.data() || {};
    if (claim.status !== 'pending') throw new Error('This task claim has already been reviewed.');
    if (action === 'reject') {
      tx.update(claimRef, { status: 'rejected', adminNote: adminNote.trim(), reviewedAt: FieldValue.serverTimestamp() });
      return;
    }
    const taskSettings = await tx.get(db.collection('settings').doc('reseller'));
    const tasks = Array.isArray(taskSettings.data()?.resellerTasks) ? taskSettings.data()?.resellerTasks : DEFAULT_RESELLER_TASKS;
    const task = tasks.find((item: any) => item?.id === claim.taskId);
    const points = Math.max(0, Math.floor(n(task?.reward)));
    if (!points) throw new Error('This task is not active or has no point reward.');
    const profileRef = db.collection('reseller_profiles').doc(String(claim.userId));
    const profile = await tx.get(profileRef);
    if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Reseller profile is not active.');
    const ledgerRef = db.collection('reseller_point_ledger').doc(claimId);
    tx.create(ledgerRef, { id: claimId, userId: claim.userId, claimId, taskId: claim.taskId, points, reason: task.title || claim.taskId, status: 'approved', createdAt: FieldValue.serverTimestamp() });
    tx.update(profileRef, { pointsBalance: FieldValue.increment(points), updatedAt: FieldValue.serverTimestamp() });
    tx.update(claimRef, { status: 'approved', points, adminNote: adminNote.trim(), reviewedAt: FieldValue.serverTimestamp() });
  });
}

const SOCIAL_TASK_IDS = new Set(['youtube', 'instagram', 'tiktok']);

export async function recordResellerTaskOpen(userId: string, taskId: string) {
  if (!SOCIAL_TASK_IDS.has(taskId)) throw new Error('Only social tasks can be opened here.');
  const db = getAdminDb();
  const profile = await db.collection('reseller_profiles').doc(userId).get();
  if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Join the Reseller Club first.');
  await db.collection('reseller_task_events').add({ userId, taskId, event: 'opened', createdAt: FieldValue.serverTimestamp() });
}

export function isSocialResellerTask(taskId: string) {
  return SOCIAL_TASK_IDS.has(taskId);
}