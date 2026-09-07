import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyPrimeHubAdminRequest } from '@/lib/adminSession';
import { sanitizeSalaarImageUrls } from '@/lib/salaarAiRouter';
import { sanitizeSalaarSalesMemory } from '@/lib/salaarSalesMemoryCore';
import { POST as chatPost } from '../../salaar/chat/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanText(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
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

function compactCart(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, 20) : [];
}

function cartSummary(value: any) {
  if (!value || typeof value !== 'object') return null;
  const items = Array.isArray(value.items) ? value.items.slice(0, 50).map((item: any) => ({
    id: cleanText(item?.id, 160),
    productId: cleanText(item?.productId, 140),
    name: cleanText(item?.name, 160) || 'Product',
    price: Number(item?.price || 0),
    originalPrice: Number(item?.originalPrice || item?.price || 0),
    image: cleanText(item?.image, 800),
    qty: Math.max(1, Number(item?.qty || 1)),
    variant: item?.variant && typeof item.variant === 'object' ? {
      color: cleanText(item.variant.color, 80),
      size: cleanText(item.variant.size, 80),
    } : null,
  })) : [];
  return {
    items,
    itemCount: Math.max(0, Number(value.itemCount || items.reduce((sum: number, item: any) => sum + Number(item.qty || 0), 0))),
    subtotal: Math.max(0, Number(value.subtotal || items.reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.qty || 0), 0))),
  };
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
      hasPending: Boolean(cleanText(data.pendingCustomerMessage, 20) || sanitizeSalaarImageUrls(data.pendingImageUrls).length),
      orderStage: cleanText(data.orderStage, 30) || null,
      advanceRequired: Math.max(0, Number(data.advanceRequired || 0)),
      cartSummary: cartSummary(data.cartSummary),
      readyAt: iso(data.readyAt),
      orderCompletedAt: iso(data.orderCompletedAt),
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
      hasPending: Boolean(cleanText(data.pendingCustomerMessage, 20) || sanitizeSalaarImageUrls(data.pendingImageUrls).length),
      orderStage: cleanText(data.orderStage, 30) || null,
      advanceRequired: Math.max(0, Number(data.advanceRequired || 0)),
      cartSummary: cartSummary(data.cartSummary),
      readyAt: iso(data.readyAt),
      orderCompletedAt: iso(data.orderCompletedAt),
      salesMemory: sanitizeSalaarSalesMemory(data.salesMemory),
    },
    messages: messages.docs.map((doc) => {
      const item = doc.data();
      return {
        id: doc.id,
        role: item.role === 'customer' ? 'customer' : item.role === 'admin' ? 'admin' : 'salaar',
        text: cleanText(item.text, 2000),
        imageUrls: sanitizeSalaarImageUrls(item.imageUrls),
        createdAt: iso(item.createdAt),
        provider: cleanText(item.provider, 40) || null,
        visionUsed: Boolean(item.visionUsed),
        needYou: Boolean(item.needYou),
        pending: Boolean(item.pending),
        phase: cleanText(item.phase, 30) || null,
      };
    }),
  };
}

async function continueSalaar(sessionId: string) {
  const db = getAdminDb();
  const ref = db.collection('salaar_conversations').doc(sessionId);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() || {} : {};
  const imageUrls = sanitizeSalaarImageUrls(data.pendingImageUrls);
  const pending = cleanText(data.pendingCustomerMessage, 600)
    || (imageUrls.length ? 'Is image ko dekh kar design, color aur matching PrimeHub products ke bare mein help karein.' : '');
  const pendingDocId = cleanText(data.pendingMessageDocId, 120);
  const shownProductIds = Array.isArray(data.pendingShownProductIds)
    ? data.pendingShownProductIds.map((id: unknown) => String(id)).slice(-400)
    : [];
  const salesMemory = sanitizeSalaarSalesMemory(data.pendingSalesMemory || data.salesMemory);
  const cartContext = compactCart(data.pendingCartContext);

  await ref.set({
    status: 'AUTO',
    holdType: null,
    softHoldUntil: null,
    pendingCustomerMessage: null,
    pendingShownProductIds: [],
    pendingImageUrls: [],
    pendingSalesMemory: null,
    pendingCartContext: [],
    pendingMessageDocId: null,
    needYou: false,
    updatedAt: new Date(),
  }, { merge: true });

  if (!pending) return null;
  if (pendingDocId) await ref.collection('messages').doc(pendingDocId).delete().catch(() => undefined);

  const synthetic = new Request('http://salaar.local/api/salaar/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, message: pending, shownProductIds, imageUrls, salesMemory, cartContext }),
  });
  const response = await chatPost(synthetic);
  const result = await response.json().catch(() => null);
  if (result?.needYou) await ref.set({ needYou: true }, { merge: true });
  return result;
}

export async function GET(request: Request) {
  if (!await verifyPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  if (!await verifyPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
          pendingImageUrls: [],
          pendingSalesMemory: null,
          pendingCartContext: [],
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

    if (action === 'complete') {
      const snap = await ref.get();
      const data = snap.exists ? snap.data() || {} : {};
      if (cleanText(data.orderStage, 30) !== 'READY') {
        return NextResponse.json({ error: 'No READY order intent on this chat.' }, { status: 400 });
      }
      const text = 'Order handoff marked Complete by PrimeHub admin.';
      await Promise.all([
        ref.collection('messages').add({ role: 'admin', text, createdAt: now, phase: 'COMPLETE' }),
        ref.set({
          orderStage: 'COMPLETE',
          orderCompletedAt: now,
          needYou: false,
          status: 'AUTO',
          holdType: null,
          softHoldUntil: null,
          lastMessage: text,
          lastRole: 'admin',
          updatedAt: now,
        }, { merge: true }),
      ]);
      return NextResponse.json({ ok: true, orderStage: 'COMPLETE', status: 'AUTO' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Salaar admin POST failed', error);
    return NextResponse.json({ error: 'Unable to update Salaar thread.' }, { status: 500 });
  }
}
