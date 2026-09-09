import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { deleteConversationAndMessages, listConversationMessages } from '@/lib/salar/chatStore';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const snapshot = await getAdminDb().collection('salar_conversations').doc(params.id).get();
    if (!snapshot.exists) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    const messages = await listConversationMessages(params.id);
    return NextResponse.json({ conversation: { id: snapshot.id, ...snapshot.data() }, messages }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load conversation.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    await deleteConversationAndMessages(params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unable to delete conversation.' }, { status: 500 });
  }
}
