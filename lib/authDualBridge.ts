import 'server-only';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { mirrorSupabaseUpsert, recordMirrorFailure } from '@/lib/dualWriteServer';

function clean(value: unknown, max = 320) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function mirrorFirebaseIdentityFromToken(idToken: string) {
  const decoded = await getAdminAuth().verifyIdToken(idToken);
  const providerIds = Array.isArray(decoded.firebase?.sign_in_provider)
    ? decoded.firebase.sign_in_provider
    : [decoded.firebase?.sign_in_provider].filter(Boolean);

  const row = {
    firebase_uid: decoded.uid,
    email: clean(decoded.email) || null,
    display_name: clean(decoded.name) || null,
    email_verified: decoded.email_verified === true,
    provider_ids: providerIds,
    auth_source: 'firebase',
    migration_status: 'firebase_active',
    payload: {
      firebaseUid: decoded.uid,
      email: clean(decoded.email) || null,
      name: clean(decoded.name) || null,
      picture: clean(decoded.picture, 1200) || null,
      signInProvider: decoded.firebase?.sign_in_provider || null,
    },
    updated_at: new Date().toISOString(),
  };

  const result = await mirrorSupabaseUpsert({ table: 'auth_identity_map', row, conflict: 'firebase_uid' });
  if (result.attempted && !result.ok) {
    await recordMirrorFailure('auth_identity_map', decoded.uid, 'upsert', row);
    throw new Error(result.error || 'Supabase identity mirror failed.');
  }

  return { uid: decoded.uid, email: row.email, mirrored: result.attempted ? result.ok : false };
}
