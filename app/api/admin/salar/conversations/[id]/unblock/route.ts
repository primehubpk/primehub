import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const ref = getAdminDb().collection('salar_conversations').doc(params.id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  await ref.set({ blocked: false, blocked_at: null, blocked_by: null, updated_at: new Date().toISOString() }, { merge: true });
  return NextResponse.json({ ok: true, blocked: false });
}
