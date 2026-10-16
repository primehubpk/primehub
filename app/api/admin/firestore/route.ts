import { NextResponse } from 'next/server';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';
import { revalidateTag } from 'next/cache';
import { publicProductCacheTag } from '@/lib/storefrontCachePolicy';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  getSupabasePrimaryPayload,
  isSupabaseWriteConfigured,
  mapDocumentToSupabase,
  recordMirrorFailure,
  supabasePrimaryDelete,
  supabasePrimaryUpsert,
} from '@/lib/dualWriteServer';

export const runtime = 'nodejs';

const ADMIN_EMAIL = 'primehubpk1@gmail.com';
const SUPABASE_PRIMARY_COLLECTIONS = new Set([
  'products',
  'categories',
  'settings',
  'prime_skills',
  'reward_gifts',
]);

function isAuthorized(request: Request) { return authorizedWalletAdmin(request); }

// Financial documents are mutated ONLY by their audited, transactional backend routes.
const PROTECTED_FINANCIAL_COLLECTIONS = new Set([
  'orders', 'reseller_profiles', 'reseller_withdrawals', 'reseller_reward_ledger',
  'reseller_shopping_wallets', 'reseller_wallet_credits',
  'reseller_wallet_spends', 'reseller_wallet_refunds',
]);

function normalize(name: string, value: Record<string, any>) {
  if (name !== 'categories') return value;
  const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl : typeof value.iconUrl === 'string' ? value.iconUrl : '';
  return { ...value, imageUrl, iconUrl: typeof value.iconUrl === 'string' ? value.iconUrl : imageUrl };
}

function hasProductIdentity(value: Record<string, any>) {
  return String(value?.title || value?.name || '').trim().length > 0;
}

function refreshCachesForCollection(name: string, id: string) {
  if (name === 'products' || name === 'categories') {
    revalidateTag('public-catalog', { expire: 0 });
    revalidateTag('salaar-catalog', 'max');
  }
  if (name === 'products') revalidateTag(publicProductCacheTag(id), { expire: 0 });
  if (name === 'categories') revalidateTag('public-categories', { expire: 0 });
  if (name === 'settings') {
    revalidateTag('storefront-settings', { expire: 0 });
    revalidateTag('prime-skills', { expire: 0 });
  }
  if (name === 'prime_skills') revalidateTag('prime-skills', { expire: 0 });
  if (name === 'reward_gifts') revalidateTag('rewards', { expire: 0 });
  if (name === 'settings' || name === 'categories' || name === 'prime_skills' || name === 'products') {
    revalidateTag('salaar-store-knowledge', 'max');
  }
}

async function firebaseData(name: string, id: string) {
  const snapshot = await getAdminDb().collection(name).doc(id).get();
  return snapshot.exists ? (snapshot.data() || {}) : null;
}

async function currentPrimaryData(name: string, id: string) {
  try {
    const payload = await getSupabasePrimaryPayload(name, id);
    if (payload) return payload;
  } catch (error) {
    console.error(`Admin ${name}/${id} Supabase primary read failed`, error);
    throw error;
  }
  return firebaseData(name, id);
}

async function writeSupabaseFirst(name: string, id: string, data: Record<string, any>) {
  if (name === 'products' && !hasProductIdentity(data)) {
    throw new Error('Product write rejected because the product name is missing.');
  }

  const row = mapDocumentToSupabase(name, id, data, 'supabase');
  if (!row) throw new Error(`Supabase primary mapping is unavailable for ${name}.`);
  await supabasePrimaryUpsert({ table: name, row });

  try {
    await getAdminDb().collection(name).doc(id).set(data, { merge: false });
    return null;
  } catch (error) {
    console.error(`Admin ${name}/${id} Firebase mirror failed`, error);
    await recordMirrorFailure(name, id, 'upsert', data, 'firebase');
    return error instanceof Error ? error.message : String(error);
  }
}

async function deleteSupabaseFirst(name: string, id: string) {
  await supabasePrimaryDelete({ table: name, id });
  try {
    await getAdminDb().collection(name).doc(id).delete();
    return null;
  } catch (error) {
    console.error(`Admin ${name}/${id} Firebase delete mirror failed`, error);
    await recordMirrorFailure(name, id, 'delete', {}, 'firebase');
    return error instanceof Error ? error.message : String(error);
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    const name = typeof body?.name === 'string' ? body.name : '';
    const id = typeof body?.id === 'string' ? body.id : '';
    const db = getAdminDb();

    if (!name) return NextResponse.json({ error: 'Collection name is required.' }, { status: 400 });
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Origin mismatch.' }, { status: 403 });
    }
    if (PROTECTED_FINANCIAL_COLLECTIONS.has(name) && ['create', 'update', 'replace', 'set', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Financial records must be modified through their audited, transactional endpoints.' }, { status: 403 });
    }

    const supabasePrimary = SUPABASE_PRIMARY_COLLECTIONS.has(name);

    if (action === 'create') {
      const ref = db.collection(name).doc();
      const data = { ...normalize(name, body.value || {}), adminActor: ADMIN_EMAIL };

      if (supabasePrimary) {
        const mirrorWarning = await writeSupabaseFirst(name, ref.id, data);
        refreshCachesForCollection(name, ref.id);
        return NextResponse.json({ success: true, id: ref.id, primary: 'supabase', mirrorWarning });
      }

      await ref.set(data);
      refreshCachesForCollection(name, ref.id);
      return NextResponse.json({ success: true, id: ref.id, primary: 'firebase' });
    }

    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      const patch = normalize(name, body.value || {});

      if (supabasePrimary) {
        const existing = await currentPrimaryData(name, id);
        if (!existing) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
        const data = { ...existing, ...patch };
        const mirrorWarning = await writeSupabaseFirst(name, id, data);
        refreshCachesForCollection(name, id);
        return NextResponse.json({ success: true, id, primary: 'supabase', mirrorWarning });
      }

      await db.collection(name).doc(id).update(patch);
      refreshCachesForCollection(name, id);
      return NextResponse.json({ success: true, id, primary: 'firebase' });
    }

    if (action === 'replace') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      const data = { ...normalize(name, body.value || {}), adminActor: ADMIN_EMAIL };

      if (supabasePrimary) {
        const mirrorWarning = await writeSupabaseFirst(name, id, data);
        refreshCachesForCollection(name, id);
        return NextResponse.json({ success: true, id, primary: 'supabase', mirrorWarning });
      }

      await db.collection(name).doc(id).set(data, { merge: false });
      refreshCachesForCollection(name, id);
      return NextResponse.json({ success: true, id, primary: 'firebase' });
    }

    if (action === 'set') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      const patch = normalize(name, body.value || {});

      if (supabasePrimary) {
        const existing = await currentPrimaryData(name, id);
        if (name === 'products' && !existing) {
          return NextResponse.json({ error: 'Product not found. Use product creation for a new product.' }, { status: 404 });
        }
        const data = { ...(existing || {}), ...patch };
        const mirrorWarning = await writeSupabaseFirst(name, id, data);
        refreshCachesForCollection(name, id);
        return NextResponse.json({ success: true, id, primary: 'supabase', mirrorWarning });
      }

      await db.collection(name).doc(id).set(patch, { merge: true });
      refreshCachesForCollection(name, id);
      return NextResponse.json({ success: true, id, primary: 'firebase' });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });

      if (supabasePrimary) {
        const mirrorWarning = await deleteSupabaseFirst(name, id);
        refreshCachesForCollection(name, id);
        return NextResponse.json({ success: true, id, primary: 'supabase', mirrorWarning });
      }

      await db.collection(name).doc(id).delete();
      refreshCachesForCollection(name, id);
      return NextResponse.json({ success: true, id, primary: 'firebase' });
    }

    if (action === 'get') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      // The website reads Supabase-primary settings. Admin must read the very
      // same authoritative document before editing weekly deals; reading only
      // the Firestore mirror risks silently replacing newer deal schedules.
      if (name === 'settings' && isSupabaseWriteConfigured()) {
        const data = await getSupabasePrimaryPayload(name, id);
        if (data) return NextResponse.json({ success: true, exists: true, data });
      }
      const snapshot = await db.collection(name).doc(id).get();
      return NextResponse.json({ success: true, exists: snapshot.exists, data: snapshot.exists ? snapshot.data() : null });
    }

    if (action === 'list') {
      const snapshot = await db.collection(name).get();
      const documents = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
      return NextResponse.json({ success: true, documents });
    }

    return NextResponse.json({ error: 'Unsupported admin firestore action.' }, { status: 400 });
  } catch (error) {
    console.error('Admin firestore route error', error);
    const message = error instanceof Error ? error.message : 'Admin operation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
