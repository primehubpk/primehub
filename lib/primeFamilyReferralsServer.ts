import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { cashBackForTier } from '@/lib/orderBenefits';

export const REFERRAL_PREFIX = 'PRIMEFAMILY';
export const REFERRAL_CODE_PATTERN = /^PRIMEFAMILY[1-9][0-9]{0,6}$/;
const SETTINGS_DOC = 'primefamily_referrals';
const CODE_COLLECTION = 'reseller_referral_codes';
const UID_COLLECTION = 'reseller_referral_owners';

export type ReferralSettings = { enabled: boolean; percent: number };

export function cleanReferralSettings(input: unknown): ReferralSettings {
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const percent = Number(record.percent ?? 10);
  if (!Number.isSafeInteger(percent) || percent < 1 || percent > 20) {
    throw new Error('Referral cashback must be a whole number between 1% and 20%.');
  }
  return { enabled: record.enabled === true, percent };
}

export function referralCode(value: unknown): string {
  const code = String(value || '').trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : '';
}

export async function readReferralSettings(): Promise<ReferralSettings> {
  const snap = await getAdminDb().collection('settings').doc(SETTINGS_DOC).get();
  return cleanReferralSettings(snap.exists ? snap.data() : null);
}

export async function saveReferralSettings(input: unknown) {
  const value = cleanReferralSettings(input);
  await getAdminDb().collection('settings').doc(SETTINGS_DOC).set({
    ...value, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return value;
}

export async function existingMemberReferralCode(uid: string) {
  const db = getAdminDb();
  const snap = await db.collection(UID_COLLECTION).doc(uid).get();
  const code = referralCode(snap.data()?.code);
  return code || null;
}

/** Server transaction assigns stable, sequential codes. A caller cannot choose
 * their own code, and parallel clicks cannot allocate a second code for one UID.
 * A Firestore client cannot write any of the referral collections.
 */
export async function ensureMemberReferralCode(uid: string) {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(uid)) throw new Error('Invalid member account.');
  const db = getAdminDb();
  const memberRef = db.collection('reseller_profiles').doc(uid);
  const ownerRef = db.collection(UID_COLLECTION).doc(uid);
  const counterRef = db.collection('reseller_referral_counter').doc('primary');
  return db.runTransaction(async tx => {
    const [member, owner, counter] = await Promise.all([
      tx.get(memberRef), tx.get(ownerRef), tx.get(counterRef),
    ]);
    if (!member.exists || member.data()?.status !== 'active') {
      throw new Error('Create an active Prime Family account first.');
    }
    if (owner.exists) {
      const code = referralCode(owner.data()?.code);
      if (!code) throw new Error('Existing referral code is invalid. Ask support.');
      return code;
    }
    const seq = Number(counter.data()?.nextSequence ?? 1);
    if (!Number.isSafeInteger(seq) || seq < 1 || seq > 9999999) {
      throw new Error('Referral codes currently unavailable.');
    }
    const code = REFERRAL_PREFIX + seq;
    const codeRef = db.collection(CODE_COLLECTION).doc(code);
    // The monotonically increasing counter + create() prohibit reassignment.
    tx.create(codeRef, {
      code, ownerUid: uid, sequence: seq, ownerEmail: String(member.data()?.email || '').slice(0, 180),
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(ownerRef, { uid, code, sequence: seq, createdAt: FieldValue.serverTimestamp() });
    tx.set(counterRef, { nextSequence: seq + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return code;
  });
}

export type ResolvedReferral = {
  id: string;
  code: string;
  kind: 'referral';
  amount: 0;
  percent: number;
  ownerUid: string;
  referrerEarns: number;
};

export async function resolveMemberReferralCode(
  codeValue: unknown, buyerUid: string, eligibleSubtotal: number,
): Promise<ResolvedReferral> {
  const code = referralCode(codeValue);
  if (!code) throw new Error('Invalid Prime Family referral code.');
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(buyerUid)) throw new Error('Sign in to use a referral code.');
  if (!Number.isSafeInteger(eligibleSubtotal) || eligibleSubtotal <= 0) {
    throw new Error('Only qualifying products can use a referral code.');
  }
  const settings = await readReferralSettings();
  if (!settings.enabled) throw new Error('Referral rewards are not yet active.');
  const db = getAdminDb();
  const codeSnap = await db.collection(CODE_COLLECTION).doc(code).get();
  if (!codeSnap.exists || codeSnap.data()?.code !== code) throw new Error('Referral code is not available.');
  const ownerUid = String(codeSnap.data()?.ownerUid || '');
  if (ownerUid === buyerUid) throw new Error('You cannot apply your own referral code.');
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(ownerUid)) throw new Error('Referral owner not valid.');
  const owner = await db.collection('reseller_profiles').doc(ownerUid).get();
  if (!owner.exists || owner.data()?.status !== 'active') throw new Error('Referral member is not active.');
  const referrerEarns = cashBackForTier(eligibleSubtotal, settings.percent);
  return { id: code, code, kind: 'referral', amount: 0, percent: settings.percent, ownerUid, referrerEarns };
}
