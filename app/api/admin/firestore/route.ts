import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

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
      const ref = await db.collection(name).add({ ...normalize(name, body.value || {}), adminActor: ADMIN_EMAIL });
      return NextResponse.json({ success: true, id: ref.id });
    }

    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      await db.collection(name).doc(id).update(normalize(name, body.value || {}));
      return NextResponse.json({ success: true, id });
    }

    if (action === 'set') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      await db.collection(name).doc(id).set(normalize(name, body.value || {}), { merge: true });
      return NextResponse.json({ success: true, id });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
      await db.collection(name).doc(id).delete();
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
