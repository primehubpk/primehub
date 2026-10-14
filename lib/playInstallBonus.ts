import 'server-only';
import { createHash, createHmac, createSign, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mirrorResellerFirestoreDoc } from '@/lib/resellerDualMirror';

export const PLAY_INSTALL_BONUS_RUPEES = 100;
const PACKAGE = 'com.primehubmall.app';
const ENABLED = () => process.env.PLAY_INSTALL_BONUS_ENABLED === 'true';
const salt = () => {
  const value = process.env.PLAY_BONUS_DEVICE_HMAC_SECRET || '';
  if (value.length < 32) throw new Error('Play bonus anti-fraud secret is not configured.');
  return value;
};
export function bonusIsEnabled() {
  return ENABLED() && (process.env.PLAY_BONUS_DEVICE_HMAC_SECRET || '').length >= 32
    && Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}
export function deviceDigest(androidId: string) {
  if (!/^[0-9a-f]{16}$/i.test(androidId)) throw new Error('Invalid Android app-scoped ID.');
  // Never persist IMEI, Android ID, advertising ID, or raw device identifiers.
  return createHmac('sha256', salt()).update('primehub-play-bonus-v1:').update(androidId.toLowerCase()).digest('hex');
}
function blocked() { throw new Error('Play Store bonus not enabled yet; no cash has been awarded.'); }
function accountDocument(uid: string) { return getAdminDb().collection('reseller_profiles').doc(uid); }

export async function bonusChallenge(uid: string, androidId: string) {
  if (!bonusIsEnabled()) blocked();
  const db = getAdminDb();
  const profile = await accountDocument(uid).get();
  if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Active reseller account required.');
  const [claimedAccount, claimedDevice] = await Promise.all([
    db.collection('reseller_play_install_claims').doc(uid).get(),
    db.collection('reseller_play_install_devices').doc(deviceDigest(androidId)).get(),
  ]);
  if (claimedAccount.exists || claimedDevice.exists) throw new Error('This user or device already received the Play Store bonus.');
  const nonce = randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.collection('reseller_play_bonus_challenges').doc(uid).set({
    uid, nonce, deviceHash: deviceDigest(androidId),
    expiresAtMs: now + 180_000, issuedAtMs: now,
  });
  return { nonce, expiresIn: 180 };
}

type IntegrityVerdict = {
  requestDetails?: { requestPackageName?: string; nonce?: string; timestampMillis?: string };
  appIntegrity?: { appRecognitionVerdict?: string; packageName?: string };
  accountDetails?: { appLicensingVerdict?: string };
  deviceIntegrity?: { deviceRecognitionVerdict?: string[]; deviceRecall?: { values?: { bitFirst?: boolean } } };
};
export function validateBonusVerdict(payload: IntegrityVerdict, nonce: string, nowMs = Date.now()) {
  const details = payload.requestDetails || {};
  const verdictTime = Number(details.timestampMillis || 0);
  if (details.requestPackageName !== PACKAGE || details.nonce !== nonce ||
    !Number.isFinite(verdictTime) || Math.abs(nowMs - verdictTime) > 180_000) {
    throw new Error('Play Integrity challenge or app package did not match.');
  }
  if (payload.appIntegrity?.appRecognitionVerdict !== 'PLAY_RECOGNIZED'
    || payload.accountDetails?.appLicensingVerdict !== 'LICENSED'
    || !payload.deviceIntegrity?.deviceRecognitionVerdict?.includes('MEETS_DEVICE_INTEGRITY')) {
    throw new Error('Genuine Google Play installation and device verification required.');
  }
  // Where Play Console device recall beta is enabled, require unused device.
  if (payload.deviceIntegrity?.deviceRecall?.values?.bitFirst === true) {
    throw new Error('This device was already rewarded according to Google Play.');
  }
}

let cachedAccess: { value: string; until: number } | null = null;
async function googleAccessToken() {
  if (cachedAccess && Date.now() < cachedAccess.until) return cachedAccess.value;
  const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (!key.client_email || !key.private_key) throw new Error('Google service account unavailable.');
  const now = Math.floor(Date.now() / 1000);
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const payload = encode({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/playintegrity',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  });
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const assertion = `${header}.${payload}.${signer.sign(key.private_key).toString('base64url')}`;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!tokenResponse.ok) throw new Error('Google Play Integrity access unavailable.');
  const result = await tokenResponse.json();
  if (!result.access_token) throw new Error('Missing Play Integrity access token.');
  cachedAccess = { value: result.access_token, until: Date.now() + Math.min(3000, result.expires_in || 3000) * 1000 - 30000 };
  return cachedAccess.value;
}
async function googleDecodeIntegrity(integrityToken: string): Promise<IntegrityVerdict> {
  if (!integrityToken || integrityToken.length > 16000) throw new Error('Invalid integrity token.');
  const access = await googleAccessToken();
  const response = await fetch(`https://playintegrity.googleapis.com/v1/${PACKAGE}:decodeIntegrityToken`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrity_token: integrityToken }),
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Google Play could not verify this installation.');
  const result = await response.json();
  if (!result.tokenPayloadExternal) throw new Error('Google Play did not provide a verified verdict.');
  return result.tokenPayloadExternal as IntegrityVerdict;
}
export async function claimPlayInstallBonus(uid: string, androidId: string, integrityToken: string) {
  if (!bonusIsEnabled()) blocked();
  const db = getAdminDb();
  const deviceHash = deviceDigest(androidId);
  const challengeRef = db.collection('reseller_play_bonus_challenges').doc(uid);
  const challenge = await challengeRef.get();
  const nowMs = Date.now();
  if (!challenge.exists || challenge.data()?.deviceHash !== deviceHash ||
    Number(challenge.data()?.expiresAtMs || 0) < nowMs) throw new Error('Play Store verification expired. Please retry.');
  const nonce = String(challenge.data()?.nonce || '');
  const verified = await googleDecodeIntegrity(integrityToken);
  validateBonusVerdict(verified, nonce, nowMs);
  const profileRef = accountDocument(uid);
  const userRef = db.collection('reseller_play_install_claims').doc(uid);
  const deviceRef = db.collection('reseller_play_install_devices').doc(deviceHash);
  const entryRef = db.collection('reseller_wallet_credits').doc(`play-install:${uid}`);
  const outcome = await db.runTransaction(async tx => {
    const [freshChallenge, userClaim, deviceClaim, profile] = await Promise.all([
      tx.get(challengeRef), tx.get(userRef), tx.get(deviceRef), tx.get(profileRef),
    ]);
    if (!freshChallenge.exists || freshChallenge.data()?.nonce !== nonce ||
      freshChallenge.data()?.deviceHash !== deviceHash || Number(freshChallenge.data()?.expiresAtMs || 0) < Date.now()) {
      throw new Error('Bonus verification expired or was already used.');
    }
    if (userClaim.exists || deviceClaim.exists) throw new Error('This user or device already received the Play Store bonus.');
    if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Active reseller account required.');
    const available = Number(profile.data()?.walletAvailable || 0);
    if (!Number.isSafeInteger(available) || !Number.isSafeInteger(available + PLAY_INSTALL_BONUS_RUPEES)) {
      throw new Error('Invalid cash wallet balance.');
    }
    tx.update(profileRef, { walletAvailable: available + PLAY_INSTALL_BONUS_RUPEES, updatedAt: FieldValue.serverTimestamp() });
    tx.create(userRef, { uid, amount: PLAY_INSTALL_BONUS_RUPEES, createdAt: FieldValue.serverTimestamp() });
    tx.create(deviceRef, { uid, amount: PLAY_INSTALL_BONUS_RUPEES, createdAt: FieldValue.serverTimestamp() });
    tx.create(entryRef, { userId: uid, amount: PLAY_INSTALL_BONUS_RUPEES, type: 'play_install_bonus', purpose: 'withdrawable', reason: 'Verified Google Play app install', createdAt: FieldValue.serverTimestamp() });
    tx.delete(challengeRef);
    return { credited: true, amount: PLAY_INSTALL_BONUS_RUPEES, walletAvailable: available + PLAY_INSTALL_BONUS_RUPEES };
  });
  try { await mirrorResellerFirestoreDoc('reseller_profiles', uid); }
  catch (error) { console.warn('Verified bonus saved; Supabase reporting mirror deferred:', error); }
  return outcome;
}
