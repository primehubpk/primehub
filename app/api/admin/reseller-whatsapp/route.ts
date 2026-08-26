import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
const ADMIN_UID = process.env.FIREBASE_ADMIN_UID || '';

async function requireAdmin(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Unauthorized');
  const decoded = await getAdminAuth().verifyIdToken(header.slice(7));
  if (!ADMIN_UID || decoded.uid !== ADMIN_UID) throw new Error('Forbidden');
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const snap = await getAdminDb().collection('reseller_whatsapp_orders').orderBy('createdAt', 'desc').limit(100).get();
    return NextResponse.json({ requests: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load requests.' }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const id = String(body?.id || '');
    const status = String(body?.status || '');
    if (!id || !['confirmed', 'rejected'].includes(status)) return NextResponse.json({ error: 'Invalid review request.' }, { status: 400 });
    const ref = getAdminDb().collection('reseller_whatsapp_orders').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    const current = snap.data() || {};
    if (['confirmed', 'rejected'].includes(String(current.status))) return NextResponse.json({ error: 'This request has already been reviewed.' }, { status: 409 });
    await ref.update({ status, reviewedAt: new Date(), updatedAt: new Date(), adminNote: String(body?.adminNote || '').trim() });
    return NextResponse.json({ ok: true, status });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to review request.' }, { status: 403 }); }
}
