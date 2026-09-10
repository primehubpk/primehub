import { NextResponse } from 'next/server';
import { ensureSalarConversation, readSalarSid, SALAR_UNBLOCK_EMAIL, verifiedCustomerUid } from '@/lib/salar/chatStore';
import { runWorker } from '@/lib/salar/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const sid = readSalarSid(request);
  if (!sid) return NextResponse.json({ error: 'session_required' }, { status: 401 });
  try {
    const customerUid = await verifiedCustomerUid(request);
    const conversation = await ensureSalarConversation(sid, customerUid);
    const snapshot = await conversation.ref.get();
    if (snapshot.data()?.blocked === true) return NextResponse.json({ error: 'blocked', unblockEmail: SALAR_UNBLOCK_EMAIL }, { status: 403 });
    const result: any = await runWorker({ job: 'order', payload: { conversationId: conversation.id, action: 'commit' }, conversationId: conversation.id });
    if (result?.ok !== true) return NextResponse.json({ error: result?.reason || 'Unable to save order.' }, { status: 400 });
    return NextResponse.json({ ok: true, orderId: result.orderId, whatsappUrl: result.whatsappUrl || '', alreadyExists: result.alreadyExists === true }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ error: 'Unable to save Salar order.' }, { status: 500 });
  }
}
