import { NextResponse } from 'next/server';
import { ensureSalarConversation, newSalarSid, readSalarSid, salarSidCookieOptions, verifiedCustomerUid } from '@/lib/salar/chatStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const existing = readSalarSid(request);
    const sid = existing || newSalarSid();
    const customerUid = await verifiedCustomerUid(request);
    const conversation = await ensureSalarConversation(sid, customerUid);
    const response = NextResponse.json({ conversationId: conversation.id });
    if (!existing) response.cookies.set('salar_sid', sid, salarSidCookieOptions());
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to start Salar chat.' }, { status: 500 });
  }
}
