import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WHATSAPP_NUMBER = '03238878009';
const FIRESTORE_TIMEOUT_MS = 5000;

type CartItem = {
  id?: string | number;
  productId?: string;
  name?: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  imageUrl?: string;
  qty?: number;
  variant?: { color?: string; size?: string } | null;
};

function cleanText(value: unknown, max = 600): string {
  if (typeof value === 'number') return String(value).slice(0, max);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

function normalizeCart(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map((raw) => {
    const item = (raw || {}) as CartItem;
    const qty = Math.max(1, Math.min(50, Math.floor(numberValue(item.qty) || 1)));
    const price = numberValue(item.price);
    const productId = cleanText(item.productId || item.id, 140);
    return {
      id: cleanText(item.id, 160) || productId,
      productId,
      name: cleanText(item.name, 160) || 'Product',
      price,
      originalPrice: numberValue(item.originalPrice) || price,
      image: cleanText(item.image || item.imageUrl, 800),
      qty,
      variant: item.variant && typeof item.variant === 'object'
        ? { color: cleanText(item.variant.color, 80), size: cleanText(item.variant.size, 80) }
        : null,
    };
  }).filter((item) => item.productId && item.price > 0);
}

function whatsappLink(sessionId: string, itemCount: number, subtotal: number) {
  const text = [
    'Assalam o Alaikum, PrimeHubMall order Ready karna hai.',
    `Salaar session: ${sessionId}`,
    `Cart: ${itemCount} item(s) · Rs ${Math.round(subtotal).toLocaleString('en-PK')}`,
    'Rs 300 advance/order lock process continue karna hai.',
  ].join('\n');
  return `https://wa.me/923238878009?text=${encodeURIComponent(text)}`;
}

async function notifyOps(sessionId: string, items: ReturnType<typeof normalizeCart>, itemCount: number, subtotal: number) {
  const apiKey = cleanText(process.env.RESEND_API_KEY, 500);
  const to = cleanText(process.env.SALAAR_OPS_EMAIL, 320);
  const from = cleanText(process.env.SALAAR_FROM_EMAIL, 320);
  if (!apiKey || !to || !from) return { configured: false, sent: false };
  const lines = items.map((item) => `${item.name} × ${item.qty} — Rs ${Math.round(item.price * item.qty).toLocaleString('en-PK')}`);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Salaar READY · ${itemCount} item(s) · Rs ${Math.round(subtotal).toLocaleString('en-PK')}`,
        text: [`Salaar session: ${sessionId}`, 'Order stage: READY', 'Advance required: Rs 300', '', ...lines, '', `Subtotal: Rs ${Math.round(subtotal).toLocaleString('en-PK')}`, `WhatsApp: ${WHATSAPP_NUMBER}`].join('\n'),
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`ops email ${response.status}`);
    return { configured: true, sent: true };
  } catch (error) {
    console.warn('Salaar ops email unavailable', error);
    return { configured: true, sent: false };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = cleanText(body?.sessionId, 100) || crypto.randomUUID();
    const customerText = cleanText(body?.message, 600) || 'Ready';
    const items = normalizeCart(body?.cartItems);

    if (!items.length) {
      return NextResponse.json({
        sessionId,
        reply: 'Ji, Ready kar dete hain. Abhi cart empty hai — pehle product cart mein add kar dein, phir Ready bol dein.',
        provider: 'phase4-ready',
        needYou: false,
        orderIntentSaved: false,
        orderStage: 'CART_REQUIRED',
        whatsapp: null,
      });
    }

    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const now = new Date();
    const reply = `Ji, aapka cart Ready handoff mein aa gaya: ${itemCount} item(s), approx Rs ${Math.round(subtotal).toLocaleString('en-PK')}. Order lock Rs 300 advance ke baad team confirm karegi — abhi order final/locked nahi hua.`;
    const whatsapp = whatsappLink(sessionId, itemCount, subtotal);

    const db = getAdminDb();
    const ref = db.collection('salaar_conversations').doc(sessionId);
    await withTimeout(Promise.all([
      ref.collection('messages').add({ role: 'customer', text: customerText, createdAt: now, phase: 'READY' }),
      ref.collection('messages').add({ role: 'salaar', text: reply, createdAt: now, provider: 'phase4-ready', needYou: true, phase: 'READY' }),
      ref.set({
        sessionId,
        lastMessage: customerText.slice(0, 160),
        lastRole: 'customer',
        updatedAt: now,
        status: 'WAIT',
        holdType: 'HARD',
        softHoldUntil: null,
        needYou: true,
        orderStage: 'READY',
        advanceRequired: 300,
        cartSummary: { items, itemCount, subtotal: Math.round(subtotal) },
        readyAt: now,
        orderCompletedAt: null,
      }, { merge: true }),
    ]), 'Salaar ready persistence');

    const opsEmail = await notifyOps(sessionId, items, itemCount, subtotal);

    return NextResponse.json({
      sessionId,
      reply,
      provider: 'phase4-ready',
      needYou: true,
      orderIntentSaved: true,
      orderStage: 'READY',
      advanceRequired: 300,
      cartSummary: { itemCount, subtotal: Math.round(subtotal) },
      whatsapp,
      opsEmail,
    });
  } catch (error) {
    console.error('Salaar ready handoff failed', error);
    return NextResponse.json({
      reply: `Ji, Ready request mil gayi lekin backend abhi save confirm nahi kar saka. WhatsApp ${WHATSAPP_NUMBER} par cart/order message kar dein — order ko locked na samjhein jab tak team confirm na kare.`,
      provider: 'fallback',
      needYou: true,
      orderIntentSaved: false,
      orderStage: 'UNCONFIRMED',
      whatsapp: 'https://wa.me/923238878009',
    });
  }
}
