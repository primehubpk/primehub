import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { POST as livePost } from '../live/route';
import { GET as adminGet, POST as adminPost } from '../../admin/salaar/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function json(response: Response) {
  return response.json().catch(() => ({}));
}

function liveRequest(sessionId: string, message: string) {
  return new Request('http://salaar.local/api/salaar/live', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, message, shownProductIds: [] }),
  });
}

function adminRequest(body: Record<string, unknown>) {
  return new Request('http://salaar.local/api/admin/salaar', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'primehub_admin_auth=true' },
    body: JSON.stringify(body),
  });
}

async function cleanup(sessionId: string) {
  const db = getAdminDb();
  const ref = db.collection('salaar_conversations').doc(sessionId);
  const messages = await ref.collection('messages').get().catch(() => null);
  if (messages) await Promise.all(messages.docs.map((doc) => doc.ref.delete().catch(() => undefined)));
  await ref.delete().catch(() => undefined);
}

export async function GET() {
  if (process.env.VERCEL_ENV === 'production') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const sessionId = `preview-phase2-${Date.now()}`;
  try {
    const auto = await json(await livePost(liveRequest(sessionId, 'hello')));
    const human = await json(await adminPost(adminRequest({ sessionId, action: 'message', text: 'Ji, admin yahan hai.' })));
    const held = await json(await livePost(liveRequest(sessionId, 'Bangles dikhao')));
    const continued = await json(await adminPost(adminRequest({ sessionId, action: 'continue' })));
    const hardWait = await json(await adminPost(adminRequest({ sessionId, action: 'wait' })));
    const hardHeld = await json(await livePost(liveRequest(sessionId, 'kuch aur dikhao')));
    const threadResponse = await adminGet(new Request(`http://salaar.local/api/admin/salaar?sessionId=${encodeURIComponent(sessionId)}`, { headers: { cookie: 'primehub_admin_auth=true' } }));
    const thread = await json(threadResponse);

    return NextResponse.json({
      ok: Boolean(auto?.reply) && human?.status === 'WAIT' && held?.silent === true && continued?.status === 'AUTO' && hardWait?.holdType === 'HARD' && hardHeld?.silent === true,
      autoReply: auto?.reply || null,
      softHold: { adminMessage: human, customerSilent: held?.silent === true },
      continue: { status: continued?.status, pendingAnswered: Boolean(continued?.reply?.reply) },
      hardWait: { status: hardWait?.status, holdType: hardWait?.holdType, customerSilent: hardHeld?.silent === true },
      roles: Array.isArray(thread?.messages) ? thread.messages.map((message: { role?: string }) => message.role) : [],
    });
  } finally {
    await cleanup(sessionId);
  }
}
