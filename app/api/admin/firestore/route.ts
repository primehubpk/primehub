import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  getSupabasePrimaryPayload,
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

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

function normalize(name: string, value: Record<string, any>) {
  if (name !== 'categories') return value;
  const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl : typeof value.iconUrl === 'string' ? value.iconUrl : '';
  return { ...value, imageUrl, iconUrl: typeof value.iconUrl === 'string' ? value.iconUrl : imageUrl };
}

function refreshCachesForCollection(name: string) {
  if (name === 'products' || name === 'categories') {
    revalidateTag('public-catalog');
    revalidateTag('salaar-catalog');
  }
  if (name === 'products') revalidateTag('public-products');
  if (name === 'settings') {
    revalidateTag('storefront-settings');
    revalidateTag('prime-skills');
  }
  if (name === 'prime_skills') revalidateTag('prime-skills');
  if (name === 'settings' || name === 'categories' || name === 'prime_skills' || name === 'products') {
    revalidateTag('salaar-store-knowledge');
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

    const supabasePrimary = SUPABASE_PRIMARY_COLLECTIONS.has(name);

    if (action === 'create') {
      const ref = db.collection(name).doc();
      const data = { ...normalize(name, body.value || {}), adminActor: ADMIN_EMAIL };

      if (supabasePrimary) {
        const mirrorWarning = await writeSupabaseFirst(name, ref.id, data);
        refreshCachesForCollection(name);
        return NextResponse.json({ success: true, id: ref.id, primary: 'supabase', mirrorWarning });
      }

      await ref.set(data);
      refreshCachesForCollection(name);
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
        refreshCachesForCollection(name);
        return NextResponse.json({ success: true, id, primary: 'supabase', mirrorWarning });
      }

      await db.collection(name).doc(id).update(patch);
      refreshCachesForCollection(name);
      return NextResponse.json({ success: true, id, primary: 'firebase' });
    }

    if (action === 'set') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      const patch = normalize(name, body.value || {});

      if (supabasePrimary) {
        const existing = await currentPrimaryData(name, id) || {};
        const data = { ...existing, ...patch };
        const mirrorWarning = await writeSupabaseFirst(name, id, data);
        refreshCachesForCollection(name);
        return NextResponse.json({ success: true, id, primary: 'supabase', mirrorWarning });
      }

      await db.collection(name).doc(id).set(patch, { merge: true });
      refreshCachesForCollection(name);
      return NextResponse.json({ success: true, id, primary: 'firebase' });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });

      if (supabasePrimary) {
        const mirrorWarning = await deleteSupabaseFirst(name, id);
        refreshCachesForCollection(name);
        return NextResponse.json({ success: true, id, primary: 'supabase', mirrorWarning });
      }

      await db.collection(name).doc(id).delete();
      refreshCachesForCollection(name);
      return NextResponse.json({ success: true, id, primary: 'firebase' });
    }

    if (action === 'get') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
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
