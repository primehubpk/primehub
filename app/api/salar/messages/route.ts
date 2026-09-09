import { NextResponse } from 'next/server';
import { consumeSalarRateLimit, ensureSalarConversation, listConversationMessages, normalizeMessageText, readSalarSid, SALAR_UNBLOCK_EMAIL, verifiedCustomerUid } from '@/lib/salar/chatStore';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STUB = 'Salar yahan hai, asl jawab agle phase mein.';

export async function GET(request: Request) {
  const sid = readSalarSid(request);
  if (!sid) return NextResponse.json({ error: 'session_required' }, { status: 401 });
  try {
    const customerUid = await verifiedCustomerUid(request);
    const conversation = await ensureSalarConversation(sid, customerUid);
    const snapshot = await conversation.ref.get();
    const blocked = snapshot.data()?.blocked === true;
    const messages = await listConversationMessages(conversation.id);
    return NextResponse.json({ conversationId: conversation.id, blocked, messages, unblockEmail: blocked ? SALAR_UNBLOCK_EMAIL : undefined }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Salar messages.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sid = readSalarSid(request);
  if (!sid) return NextResponse.json({ error: 'session_required' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const text = normalizeMessageText(body?.text);
  if (!text) return NextResponse.json({ error: 'Message text is required.' }, { status: 400 });
  try {
    const customerUid = await verifiedCustomerUid(request);
    const conversation = await ensureSalarConversation(sid, customerUid);
    const beforeWrite = await conversation.ref.get();
    if (beforeWrite.data()?.blocked === true) {
      return NextResponse.json({ error: 'blocked', unblockEmail: SALAR_UNBLOCK_EMAIL }, { status: 403 });
    }
    if (!consumeSalarRateLimit(conversation.id)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

    const db = getAdminDb();
    const userRef = db.collection('salar_messages').doc();
    const assistantRef = db.collection('salar_messages').doc();
    const now = new Date().toISOString();
    const assistantAt = new Date(Date.now() + 1).toISOString();

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(conversation.ref);
      if (!snapshot.exists || snapshot.data()?.blocked === true) throw new Error('SALAR_BLOCKED');
      transaction.set(userRef, { id: userRef.id, conversation_id: conversation.id, role: 'user', text, attachments: [], created_at: now });
      transaction.set(assistantRef, { id: assistantRef.id, conversation_id: conversation.id, role: 'assistant', text: STUB, attachments: [], created_at: assistantAt });
      transaction.set(conversation.ref, { updated_at: assistantAt, last_message_at: assistantAt, last_message_preview: text.slice(0, 160) }, { merge: true });
    });

    return NextResponse.json({ ok: true, messages: [
      { id: userRef.id, conversation_id: conversation.id, role: 'user', text, attachments: [], created_at: now },
      { id: assistantRef.id, conversation_id: conversation.id, role: 'assistant', text: STUB, attachments: [], created_at: assistantAt },
    ] });
  } catch (error) {
    if (error instanceof Error && error.message === 'SALAR_BLOCKED') {
      return NextResponse.json({ error: 'blocked', unblockEmail: SALAR_UNBLOCK_EMAIL }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unable to save Salar message.' }, { status: 500 });
  }
}
