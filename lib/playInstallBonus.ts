import 'server-only';
import { createHmac } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mirrorResellerFirestoreDoc } from '@/lib/resellerDualMirror';

export const PLAY_INSTALL_BONUS_RUPEES = 100;
const PLAY_INSTALLER = 'com.android.vending';

/** Explicit rollout switch. No Google Play Integrity API or Google OAuth needed.
 * This is a LOW-FRICTION promotion, NOT cryptographic install attestation.
 * Native clients report their installer; this is spoofable by modified clients.
 */
export function bonusIsEnabled() {
  return process.env.PLAY_INSTALL_BONUS_ENABLED === 'true' &&
    (process.env.PLAY_BONUS_DEVICE_HMAC_SECRET || '').length >= 32;
}
export function deviceDigest(androidId: string) {
  if (!/^[0-9a-f]{16}$/i.test(androidId)) throw new Error('Invalid app-scoped Android device identifier.');
  const key = process.env.PLAY_BONUS_DEVICE_HMAC_SECRET || '';
  if (key.length < 32) throw new Error('Bonus configuration unavailable.');
  // Only an HMAC is stored. Never persist raw Android ID, IMEI, MAC, or advertising ID.
  return createHmac('sha256', key).update('primehub-play-bonus-v1:').update(androidId.toLowerCase()).digest('hex');
}

export type PlayBonusResult =
  | { credited: true; amount: number; walletAvailable: number }
  | { credited: false; alreadyClaimed: true; reason: 'account' | 'device' };

/** Firebase transaction guarantees at most one bonus per UID and submitted
 * device identifier, even on parallel login/retry. Real balance never changes
 * for an already-claimed account/device. Uses existing email/password identity.
 */
export async function claimPlayInstallBonus(
  uid: string, email: string, androidId: string, installer: string,
): Promise<PlayBonusResult> {
  if (!bonusIsEnabled()) throw new Error('Play Store bonus is not enabled yet.');
  if (installer !== PLAY_INSTALLER) throw new Error('Install PrimeHub from Google Play to receive this bonus.');
  if (!uid || !email || !email.includes('@')) throw new Error('Sign in with your PrimeHub email and password.');
  const hash = deviceDigest(androidId);
  const db = getAdminDb();
  const profileRef = db.collection('reseller_profiles').doc(uid);
  const accountRef = db.collection('reseller_play_install_claims').doc(uid);
  const deviceRef = db.collection('reseller_play_install_devices').doc(hash);
  const auditRef = db.collection('reseller_wallet_credits').doc('play-install:' + uid);

  const outcome = await db.runTransaction(async tx => {
    const [profile, accountClaim, deviceClaim, audit] = await Promise.all([
      tx.get(profileRef), tx.get(accountRef), tx.get(deviceRef), tx.get(auditRef),
    ]);
    // The ledger also prevents repayment if account marker was manually removed.
    if (accountClaim.exists || audit.exists) return { credited: false, alreadyClaimed: true, reason: 'account' } as const;
    if (deviceClaim.exists) return { credited: false, alreadyClaimed: true, reason: 'device' } as const;
    const current = profile.data();
    if (profile.exists && current?.status !== 'active') throw new Error('Your account is not active.');
    const available = Number(current?.walletAvailable ?? 0);
    if (!Number.isSafeInteger(available) || available < 0 ||
      !Number.isSafeInteger(available + PLAY_INSTALL_BONUS_RUPEES)) throw new Error('Invalid cash wallet balance.');

    if (!profile.exists) {
      // Reuse the existing reseller profile/wallet for an already-signed-in
      // email/password account. No separate signup or new auth provider.
      tx.create(profileRef, {
        userId: uid, email, displayName: '', status: 'active', tierId: 'starter',
        monthlyOrders: 0, walletAvailable: PLAY_INSTALL_BONUS_RUPEES,
        walletPending: 0, walletShopping: 0,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(profileRef, {
        walletAvailable: available + PLAY_INSTALL_BONUS_RUPEES,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    const record = { uid, amount: PLAY_INSTALL_BONUS_RUPEES, createdAt: FieldValue.serverTimestamp() };
    tx.create(accountRef, record);
    tx.create(deviceRef, record);
    tx.create(auditRef, {
      userId: uid, amount: PLAY_INSTALL_BONUS_RUPEES,
      type: 'play_install_bonus', purpose: 'withdrawable',
      reason: 'PrimeHub Google Play app welcome reward (one time)',
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      credited: true, amount: PLAY_INSTALL_BONUS_RUPEES,
      walletAvailable: available + PLAY_INSTALL_BONUS_RUPEES,
    } as const;
  });

  if (outcome.credited) {
    try { await mirrorResellerFirestoreDoc('reseller_profiles', uid); }
    catch (error) {
      // Firestore is authoritative. Mirror failure must never trigger another cash award.
      console.warn('Play bonus credited; Supabase reporting mirror delayed:', error);
    }
  }
  return outcome;
}
