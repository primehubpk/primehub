import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const snapshot = await getAdminDb().collection('salar_conversations').get();
    const conversations = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => String(b.last_message_at || b.updated_at || '').localeCompare(String(a.last_message_at || a.updated_at || '')));
    return NextResponse.json({ conversations }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Salar conversations.' }, { status: 500 });
  }
}
