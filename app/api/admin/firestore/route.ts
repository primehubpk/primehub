import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mapFirebaseDocumentToSupabase, mirrorSupabaseDelete, mirrorSupabaseUpsert, recordMirrorFailure } from '@/lib/dualWriteServer';

export const runtime = 'nodejs';

const ADMIN_EMAIL = 'primehubpk1@gmail.com';

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
  if (name === 'settings') revalidateTag('storefront-settings');
  if (name === 'prime_skills') revalidateTag('prime-skills');

  // Salaar Store Knowledge is derived from settings, categories and Prime Skills.
  // Product changes can also affect future deal/search knowledge, so invalidate on
  // all storefront-managed sources rather than waiting for the 15-minute safety TTL.
  if (name === 'settings' || name === 'categories' || name === 'prime_skills' || name === 'products') {
    revalidateTag('salaar-store-knowledge');
  }
}

async function mirrorFinalDocument(name: string, id: string) {
  const snapshot = await getAdminDb().collection(name).doc(id).get();
  if (!snapshot.exists) return;
  const row = mapFirebaseDocumentToSupabase(name, id, snapshot.data() || {});
  if (!row) return;
  const result = await mirrorSupabaseUpsert({ table: name, row });
  if (result.attempted && !result.ok) {
    console.error(`Admin ${name}/${id} Supabase mirror failed`, result.error);
    await recordMirrorFailure(name, id, 'upsert', row);
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

    if (action === 'create') {
      const ref = db.collection(name).doc();
      await ref.set({ ...normalize(name, body.value || {}), adminActor: ADMIN_EMAIL });
      await mirrorFinalDocument(name, ref.id);
      refreshCachesForCollection(name);
      return NextResponse.json({ success: true, id: ref.id });
    }

    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      await db.collection(name).doc(id).update(normalize(name, body.value || {}));
      await mirrorFinalDocument(name, id);
      refreshCachesForCollection(name);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'set') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      await db.collection(name).doc(id).set(normalize(name, body.value || {}), { merge: true });
      await mirrorFinalDocument(name, id);
      refreshCachesForCollection(name);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      await db.collection(name).doc(id).delete();
      const result = await mirrorSupabaseDelete({ table: name, id });
      if (result.attempted && !result.ok) {
        console.error(`Admin ${name}/${id} Supabase delete mirror failed`, result.error);
        await recordMirrorFailure(name, id, 'delete', {});
      }
      refreshCachesForCollection(name);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'get') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      const snapshot = await db.collection(name).doc(id).get();
      return NextResponse.json({ success: true, exists: snapshot.exists, data: snapshot.exists ? snapshot.data() : null });
    }

    return NextResponse.json({ error: 'Unsupported admin firestore action.' }, { status: 400 });
  } catch (error) {
    console.error('Admin firestore route error', error);
    return NextResponse.json({ error: 'Admin operation failed.' }, { status: 500 });
  }
}
