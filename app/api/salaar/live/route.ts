import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { GET as chatGet, POST as chatPost } from '../chat/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PendingReply = {
  message: string;
  shownProductIds: string[];
  messageDocId?: string;
};

const FIRESTORE_TIMEOUT_MS = 5000;

function cleanText(value: unknown, max = 600): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    try { return (value as { toDate: () => Date }).toDate(); } catch { return null; }
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function withTimeout<T>(promise: Promise<T>, label: string, ms = FIRESTORE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function delegatePost(sessionId: string, message: string, shownProductIds: string[]) {
  const synthetic = new Request('http://salaar.local/api/salaar/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, message, shownProductIds }),
  });
  return chatPost(synthetic);
}

async function claimExpiredPending(sessionId: string): Promise<PendingReply | null> {
  const db = getAdminDb();
  const ref = db.collection('salaar_conversations').doc(sessionId);
  let claimed: PendingReply | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (data.status !== 'WAIT' || data.holdType !== 'SOFT') return;
    const until = asDate(data.softHoldUntil);
    if (!until || until.getTime() > Date.now()) return;

    const message = cleanText(data.pendingCustomerMessage, 600);
    const shownProductIds = Array.isArray(data.pendingShownProductIds)
      ? data.pendingShownProductIds.map((id: unknown) => String(id)).slice(-100)
      : [];
    const messageDocId = cleanText(data.pendingMessageDocId, 120) || undefined;

    tx.set(ref, {
      status: 'AUTO',
      holdType: null,
      softHoldUntil: null,
      pendingCustomerMessage: null,
      pendingShownProductIds: [],
      pendingMessageDocId: null,
      updatedAt: new Date(),
    }, { merge: true });

    if (message) claimed = { message, shownProductIds, messageDocId };
  });

  return claimed;
}

async function resumeClaimed(sessionId: string, pending: PendingReply | null) {
  if (!pending?.message) return;
  const db = getAdminDb();
  if (pending.messageDocId) {
    await withTimeout(
      db.collection('salaar_conversations').doc(sessionId).collection('messages').doc(pending.messageDocId).delete(),
      'Salaar pending message delete',
    ).catch(() => undefined);
  }
  await delegatePost(sessionId, pending.message, pending.shownProductIds);
}

async function currentState(sessionId: string) {
  const snap = await withTimeout(
    getAdminDb().collection('salaar_conversations').doc(sessionId).get(),
    'Salaar conversation state read',
  );
  return snap.exists ? (snap.data() || {}) : {};
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = cleanText(url.searchParams.get('sessionId'), 100);
  if (!sessionId) return NextResponse.json({ messages: [] });

  try {
    const pending = await withTimeout(claimExpiredPending(sessionId), 'Salaar soft hold transaction');
    await resumeClaimed(sessionId, pending);
  } catch (error) {
    console.warn('Salaar soft hold resume failed', error);
  }

  const delegated = new Request(new URL(`/api/salaar/chat?sessionId=${encodeURIComponent(sessionId)}`, request.url), { method: 'GET' });
  return chatGet(delegated);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = cleanText(body?.sessionId, 100) || crypto.randomUUID();
    const message = cleanText(body?.message, 600);
    const shownProductIds = Array.isArray(body?.shownProductIds)
      ? body.shownProductIds.map((id: unknown) => String(id)).slice(-100)
      : [];
    if (!message) return NextResponse.json({ error: 'Message required.' }, { status: 400 });

    const expired = await withTimeout(claimExpiredPending(sessionId), 'Salaar soft hold transaction');
    await resumeClaimed(sessionId, expired);

    const state = await currentState(sessionId);
    const hardWait = state.status === 'WAIT' && state.holdType === 'HARD';
    const softUntil = asDate(state.softHoldUntil);
    const softWait = state.status === 'WAIT' && state.holdType === 'SOFT' && (!softUntil || softUntil.getTime() > Date.now());
    const genericWait = state.status === 'WAIT' && !state.holdType;

    if (hardWait || softWait || genericWait) {
      const db = getAdminDb();
      const ref = db.collection('salaar_conversations').doc(sessionId);
      const now = new Date();
      const messageRef = await withTimeout(
        ref.collection('messages').add({ role: 'customer', text: message, createdAt: now, pending: true }),
        'Salaar pending customer write',
      );
      await withTimeout(ref.set({
        sessionId,
        lastMessage: message.slice(0, 160),
        lastRole: 'customer',
        updatedAt: now,
        pendingCustomerMessage: message,
        pendingShownProductIds: shownProductIds,
        pendingMessageDocId: messageRef.id,
      }, { merge: true }), 'Salaar pending state write');
      return NextResponse.json({ sessionId, silent: true, status: 'WAIT' });
    }

    const response = await delegatePost(sessionId, message, shownProductIds);
    const data = await response.clone().json().catch(() => ({}));
    if (data?.needYou) {
      await withTimeout(
        getAdminDb().collection('salaar_conversations').doc(sessionId).set({ needYou: true }, { merge: true }),
        'Salaar needYou write',
      ).catch(() => undefined);
    }
    return response;
  } catch (error) {
    console.error('Salaar live wrapper failed', error);
    return NextResponse.json({ reply: 'Ji, abhi short technical issue hai. WhatsApp 03238878009 par message kar dein.', provider: 'fallback', needYou: true, whatsapp: 'https://wa.me/923238878009' });
  }
}
