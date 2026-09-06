import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { POST as chatPost } from '../../salaar/chat/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanText(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isAdmin(request: Request): boolean {
  const cookie = request.headers.get('cookie') || '';
  return /(?:^|;\s*)primehub_admin_auth=true(?:;|$)/.test(cookie);
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    try { return (value as { toDate: () => Date }).toDate().toISOString(); } catch { return null; }
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function listConversations() {
  const db = getAdminDb();
  const snap = await db.collection('salaar_conversations').orderBy('updatedAt', 'desc').limit(100).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      sessionId: doc.id,
      lastMessage: cleanText(data.lastMessage, 180),
      lastRole: cleanText(data.lastRole, 30),
      status: data.status === 'WAIT' ? 'WAIT' : 'AUTO',
      holdType: data.holdType === 'HARD' ? 'HARD' : data.holdType === 'SOFT' ? 'SOFT' : null,
      softHoldUntil: iso(data.softHoldUntil),
      needYou: Boolean(data.needYou),
      updatedAt: iso(data.updatedAt),
      hasPending: Boolean(cleanText(data.pendingCustomerMessage, 20)),
    };
  });
}

async function getThread(sessionId: string) {
  const db = getAdminDb();
  const ref = db.collection('salaar_conversations').doc(sessionId);
  const [conversation, messages] = await Promise.all([
    ref.get(),
    ref.collection('messages').orderBy('createdAt', 'asc').limit(150).get(),
  ]);
  const data = conversation.exists ? conversation.data() || {} : {};
  return {
    conversation: {
      sessionId,
      status: data.status === 'WAIT' ? 'WAIT' : 'AUTO',
      holdType: data.holdType === 'HARD' ? 'HARD' : data.holdType === 'SOFT' ? 'SOFT' : null,
      softHoldUntil: iso(data.softHoldUntil),
      needYou: Boolean(data.needYou),
      hasPending: Boolean(cleanText(data.pendingCustomerMessage, 20)),
    },
    messages: messages.docs.map((doc) => {
      const item = doc.data();
      return {
        id: doc.id,
        role: item.role === 'customer' ? 'customer' : item.role === 'admin' ? 'admin' : 'salaar',
        text: cleanText(item.text, 2000),
        createdAt: iso(item.createdAt),
        provider: cleanText(item.provider, 40) || null,
        needYou: Boolean(item.needYou),
        pending: Boolean(item.pending),
      };
    }),
  };
}

async function continueSalaar(sessionId: string) {
  const db = getAdminDb();
  const ref = db.collection('salaar_conversations').doc(sessionId);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() || {} : {};
  const pending = cleanText(data.pendingCustomerMessage, 600);
  const pendingDocId = cleanText(data.pendingMessageDocId, 120);
  const shownProductIds = Array.isArray(data.pendingShownProductIds)
    ? data.pendingShownProductIds.map((id: unknown) => String(id)).slice(-100)
    : [];

  await ref.set({
    status: 'AUTO',
    holdType: null,
    softHoldUntil: null,
    pendingCustomerMessage: null,
    pendingShownProductIds: [],
    pendingMessageDocId: null,
    needYou: false,
    updatedAt: new Date(),
  }, { merge: true });

  if (!pending) return null;
  if (pendingDocId) await ref.collection('messages').doc(pendingDocId).delete().catch(() => undefined);

  const synthetic = new Request('http://salaar.local/api/salaar/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, message: pending, shownProductIds }),
  });
  const response = await chatPost(synthetic);
  const result = await response.json().catch(() => null);
  if (result?.needYou) await ref.set({ needYou: true }, { merge: true });
  return result;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const sessionId = cleanText(url.searchParams.get('sessionId'), 100);
    if (sessionId) return NextResponse.json(await getThread(sessionId));
    return NextResponse.json({ conversations: await listConversations() });
  } catch (error) {
    console.error('Salaar admin GET failed', error);
    return NextResponse.json({ error: 'Unable to load Salaar inbox.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const sessionId = cleanText(body?.sessionId, 100);
    const action = cleanText(body?.action, 30);
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

    const db = getAdminDb();
    const ref = db.collection('salaar_conversations').doc(sessionId);
    const now = new Date();

    if (action === 'message') {
      const text = cleanText(body?.text, 1200);
      if (!text) return NextResponse.json({ error: 'Message required' }, { status: 400 });
      await Promise.all([
        ref.collection('messages').add({ role: 'admin', text, createdAt: now }),
        ref.set({
          sessionId,
          lastMessage: text.slice(0, 160),
          lastRole: 'admin',
          updatedAt: now,
          status: 'WAIT',
          holdType: 'SOFT',
          softHoldUntil: new Date(now.getTime() + 60 * 60 * 1000),
          pendingCustomerMessage: null,
          pendingShownProductIds: [],
          pendingMessageDocId: null,
          needYou: false,
        }, { merge: true }),
      ]);
      return NextResponse.json({ ok: true, status: 'WAIT', holdType: 'SOFT' });
    }

    if (action === 'wait') {
      await ref.set({ status: 'WAIT', holdType: 'HARD', softHoldUntil: null, updatedAt: now }, { merge: true });
      return NextResponse.json({ ok: true, status: 'WAIT', holdType: 'HARD' });
    }

    if (action === 'continue') {
      const reply = await continueSalaar(sessionId);
      return NextResponse.json({ ok: true, status: 'AUTO', reply });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Salaar admin POST failed', error);
    return NextResponse.json({ error: 'Unable to update Salaar thread.' }, { status: 500 });
  }
}
