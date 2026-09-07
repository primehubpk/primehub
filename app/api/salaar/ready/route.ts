import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getLiveSalaarCatalogSnapshot } from '@/lib/salaarCatalogCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WHATSAPP_NUMBER = '03238878009';
const FIRESTORE_TIMEOUT_MS = 5000;
const CATALOG_TIMEOUT_MS = 10000;

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

function liveProductPrice(product: any): number {
  return numberValue(product?.price || product?.salePrice || product?.retailPrice);
}

function liveProductName(product: any, fallback: string): string {
  return cleanText(product?.title || product?.name, 160) || fallback;
}

function liveProductImage(product: any, fallback: string): string {
  const direct = cleanText(product?.imageUrl || product?.image, 800);
  if (direct) return direct;
  if (Array.isArray(product?.images)) {
    for (const raw of product.images) {
      if (typeof raw === 'string' && raw) return cleanText(raw, 800);
      const nested = cleanText(raw?.url || raw?.imageUrl, 800);
      if (nested) return nested;
    }
  }
  return fallback;
}

function explicitOutOfStock(product: any): boolean {
  const raw = product?.stock;
  if (raw === null || raw === undefined || raw === '') return false;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed <= 0;
}

async function reconcileCartWithLiveCatalog(items: ReturnType<typeof normalizeCart>) {
  const catalog = await withTimeout(getLiveSalaarCatalogSnapshot(), 'Salaar live catalog verification', CATALOG_TIMEOUT_MS);
  const byId = new Map((Array.isArray(catalog.products) ? catalog.products : []).map((product: any) => [String(product.id), product]));
  const issues: string[] = [];
  let priceAdjusted = false;

  const verified = items.map((item) => {
    const product = byId.get(String(item.productId));
    if (!product) {
      issues.push(`${item.name}: product not found`);
      return item;
    }
    if (product.active === false) issues.push(`${item.name}: unavailable`);
    if (explicitOutOfStock(product)) issues.push(`${item.name}: out of stock`);

    const livePrice = liveProductPrice(product);
    if (!livePrice) {
      issues.push(`${item.name}: current price unavailable`);
      return item;
    }
    if (Math.round(livePrice) !== Math.round(item.price)) priceAdjusted = true;

    return {
      ...item,
      name: liveProductName(product, item.name),
      price: livePrice,
      originalPrice: numberValue(product?.originalPrice || product?.compareAtPrice || product?.retailPrice) || livePrice,
      image: liveProductImage(product, item.image),
    };
  });

  return { items: verified, issues, priceAdjusted, source: catalog.source };
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
    const submittedItems = normalizeCart(body?.cartItems);

    if (!submittedItems.length) {
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

    const live = await reconcileCartWithLiveCatalog(submittedItems);
    if (live.issues.length) {
      return NextResponse.json({
        sessionId,
        reply: 'Ji, Ready se pehle latest catalog check mein ek item ka price/stock/availability confirm nahi hua. Cart ko refresh kar dein ya WhatsApp par team se confirm kar lein — order abhi lock nahi hua.',
        provider: 'phase4-ready-live-check',
        needYou: true,
        orderIntentSaved: false,
        orderStage: 'REVIEW_REQUIRED',
        catalogSource: live.source,
        reviewItems: live.issues.slice(0, 10),
        whatsapp: 'https://wa.me/923238878009',
      });
    }

    const items = live.items;
    const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const now = new Date();
    const priceNote = live.priceAdjusted ? ' Latest catalog price cart mein update kar di gayi hai.' : '';
    const reply = `Ji, aapka cart Ready handoff mein aa gaya: ${itemCount} item(s), approx Rs ${Math.round(subtotal).toLocaleString('en-PK')}.${priceNote} Order lock Rs 300 advance ke baad team confirm karegi — abhi order final/locked nahi hua.`;
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
        catalogVerifiedAt: now,
        catalogSource: live.source,
        priceAdjusted: live.priceAdjusted,
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
      catalogSource: live.source,
      priceAdjusted: live.priceAdjusted,
      cartSummary: { itemCount, subtotal: Math.round(subtotal) },
      whatsapp,
      opsEmail,
    });
  } catch (error) {
    console.error('Salaar ready handoff failed', error);
    return NextResponse.json({
      reply: `Ji, Ready request mil gayi lekin latest catalog/backend abhi confirm nahi ho saka. WhatsApp ${WHATSAPP_NUMBER} par cart/order message kar dein — order ko locked na samjhein jab tak team confirm na kare.`,
      provider: 'fallback',
      needYou: true,
      orderIntentSaved: false,
      orderStage: 'UNCONFIRMED',
      whatsapp: 'https://wa.me/923238878009',
    });
  }
}
