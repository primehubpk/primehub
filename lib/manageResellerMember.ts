import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { getSupabasePrimaryPayload } from '@/lib/dualWriteServer';
import { mirrorResellerFirestoreDoc } from '@/lib/resellerDualMirror';

type Action = 'block' | 'unblock' | 'delete';

export async function manageResellerMember(userId: string, action: Action, reason: string) {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(userId)) throw new Error('Invalid member UID.');
  if (!reason.trim() || reason.trim().length > 240) throw new Error('A reason is required (up to 240 characters).');
  if (process.env.FIREBASE_ADMIN_UID && userId === process.env.FIREBASE_ADMIN_UID) throw new Error('Admin account cannot be changed here.');
  const db = getAdminDb();
  const auth = getAdminAuth();
  const ref = db.collection('reseller_profiles').doc(userId);
  const profile = await ref.get();
  if (!profile.exists) throw new Error('Reseller account not found.');
  const current = profile.data() || {};
  if (current.status === 'deleted') throw new Error('This member has already been deleted.');
  if (action === 'delete') {
    // Destructive account deletion never destroys reward, withdrawal or financial audit history.
    const [shopping, pendingWithdrawal, pendingReward, claims, rewards] = await Promise.all([
      db.collection('reseller_shopping_wallets').doc(userId).get(),
      db.collection('reseller_withdrawals').where('userId','==',userId).where('status','in',['pending','approved']).limit(1).get(),
      db.collection('reseller_reward_ledger').where('userId','==',userId).where('status','==','pending').limit(1).get(),
      db.collection('reseller_task_claims').where('userId','==',userId).where('status','==','pending').limit(1).get(),
      getSupabasePrimaryPayload('user_rewards',userId),
    ]);
    const firebaseRewards = await db.collection('user_rewards').doc(userId).get();
    const livePoints = Math.max(Number(rewards?.points || 0), Number(firebaseRewards.data()?.points || 0));
    if ([Number(current.walletAvailable || 0),Number(current.walletPending || 0),Number(shopping.data()?.balance || 0),Number(current.pointsBalance || 0),livePoints].some(n => !Number.isFinite(n) || n !== 0) ||
      !pendingWithdrawal.empty || !pendingReward.empty || !claims.empty) {
      throw new Error('Account has money, points, or pending claims. Settle these first; Block is available without deleting history.');
    }
  }
  if (action === 'unblock' && current.status !== 'suspended') throw new Error('Only blocked accounts can be unblocked.');
  if (action === 'block' && current.status === 'suspended') return { action, status: 'suspended', unchanged: true };
  const status = action === 'block' ? 'suspended' : action === 'unblock' ? 'active' : 'deleted';
  // Firebase Auth disables sign-in. Re-enable only for an explicitly requested unblock.
  if (action === 'delete') {
    await auth.updateUser(userId, { disabled: true });
    await auth.revokeRefreshTokens(userId);
  } else {
    await auth.updateUser(userId, { disabled: action === 'block' });
    if (action === 'block') await auth.revokeRefreshTokens(userId);
  }
  try {
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp(), lastAdminAction: action, lastAdminReason: reason.trim() });
  } catch (error) {
    if (action !== 'delete') {
      try { await auth.updateUser(userId, { disabled: action === 'unblock' }); } catch {}
    }
    throw error;
  }
  if (action === 'delete') {
    // Auth identity is deleted; reseller and event records are retained for compliance and reconciliation.
    try { await auth.deleteUser(userId); }
    catch (error) { console.error('Member disabled and archived, Firebase Auth delete requires retry:', error); }
  }
  try { await mirrorResellerFirestoreDoc('reseller_profiles', userId); }
  catch (error) { console.error('Reseller status mirror will need retry:', error); }
  return { action, status };
}
