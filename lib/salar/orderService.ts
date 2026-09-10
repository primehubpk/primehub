import 'server-only';

import { createHash } from 'crypto';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { calculateDeliveryCharge } from '@/lib/deliveryCharges';
import { isWholesaleProduct } from '@/lib/wholesale';
import { mapOrderToSupabase, mirrorSupabaseUpsert, recordMirrorFailure } from '@/lib/dualWriteServer';

const ADVANCE_AMOUNT = 300;

type SalarOrderAction = 'quote' | 'commit';
type DraftItem = { productId?: string; id?: string; quantity?: number; qty?: number; variantKey?: string | null };
type CustomerDraft = { name?: string; city?: string; phone?: string; address?: string };

type AuthoritativeItem = {
  productId: string;
  title: string;
  quantity: number;
  price: number;
  lineTotal: number;
  variantKey?: string | null;
  isWholesale?: unknown;
  category?: unknown;
  categoryId?: unknown;
};

function qty(value: unknown) {
  return Math.max(1, Math.min(99, Math.floor(Number(value) || 1)));
}

function cleanPhone(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsappNumber(value: unknown) {
  let digits = cleanPhone(value);
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith('3')) digits = `92${digits}`;
  return /^\d{10,15}$/.test(digits) ? digits : '';
}

function variantRows(product: any) {
  const matrix = Array.isArray(product?.variantMatrix) ? product.variantMatrix : [];
  if (matrix.length) return matrix;
  return Array.isArray(product?.variants) ? product.variants : [];
}

function variantPrice(product: any, variantKey?: string | null) {
  if (!variantKey) return Number(product?.price) || 0;
  const row = variantRows(product).find((item: any) => String(item?.key || item?.id || item?.name || '') === variantKey);
  return Number(row?.price ?? product?.price) || 0;
}

function weeklyDealPrice(product: any) {
  const candidates = [product?.weeklyDealPrice, product?.weekendPrice, product?.dealPrice, product?.salePrice]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  const enabled = product?.isWeeklyDeal === true || product?.isWeekendSpecial === true || product?.isFlashSale === true;
  return enabled && candidates.length ? Math.min(...candidates) : null;
}

async function authoritativeItems(items: DraftItem[]): Promise<AuthoritativeItem[]> {
  const db = getAdminDb();
  const output: AuthoritativeItem[] = [];
  for (const input of items) {
    const productId = String(input.productId || input.id || '').trim();
    if (!productId) throw new Error('ORDER_ITEMS_MISSING');
    const snap = await db.collection('products').doc(productId).get();
    if (!snap.exists) throw new Error('ORDER_PRODUCT_MISSING');
    const product: any = snap.data() || {};
    if (product.active === false) throw new Error('ORDER_PRODUCT_UNAVAILABLE');
    const quantity = qty(input.quantity ?? input.qty);
    const stockValue = product.stock ?? product.quantity;
    if (stockValue != null && Number.isFinite(Number(stockValue)) && Number(stockValue) < quantity) throw new Error('ORDER_STOCK_LOW');
    const standard = variantPrice(product, input.variantKey || null);
    const deal = weeklyDealPrice(product);
    const price = deal && deal < standard ? deal : standard;
    if (!Number.isFinite(price) || price < 0) throw new Error('ORDER_PRICE_INVALID');
    output.push({
      productId,
      title: String(product.title || product.name || productId),
      quantity,
      price,
      lineTotal: price * quantity,
      variantKey: input.variantKey || null,
      isWholesale: product.isWholesale,
      category: product.category,
      categoryId: product.categoryId,
    });
  }
  return output;
}

async function whatsappNumber() {
  const envNumber = normalizeWhatsappNumber(process.env.WHATSAPP_BUSINESS_NUMBER);
  if (envNumber) return envNumber;
  const db = getAdminDb();
  for (const id of ['main', 'contact']) {
    const snap = await db.collection('settings').doc(id).get();
    if (!snap.exists) continue;
    const data: any = snap.data() || {};
    const contact = data.contact && typeof data.contact === 'object' ? data.contact : {};
    const candidates = [data.adminWhatsappNumber, data.whatsappNumber, data.whatsapp, data.whatsappPhone, data.phone, contact.whatsappNumber, contact.whatsapp, contact.phone];
    for (const value of candidates) {
      const number = normalizeWhatsappNumber(value);
      if (number) return number;
    }
  }
  return '';
}

function fingerprint(conversationId: string, items: AuthoritativeItem[]) {
  const basis = items.map((item) => `${item.productId}:${item.variantKey || ''}:${item.quantity}`).sort().join('|');
  return createHash('sha256').update(`${conversationId}|${basis}`).digest('hex').slice(0, 24);
}

function summaryText(orderId: string, quote: any, customer: CustomerDraft) {
  const lines = quote.items.map((item: AuthoritativeItem) => `${item.title} x${item.quantity} — Rs ${item.lineTotal.toLocaleString()}`);
  return [
    `PrimeHub Salar Order #${orderId.slice(-8)}`,
    ...lines,
    `Subtotal: Rs ${quote.subtotal.toLocaleString()}`,
    `Delivery: Rs ${quote.deliveryCharge.toLocaleString()}`,
    `Total: Rs ${quote.total.toLocaleString()}`,
    `Advance screenshot: Rs ${ADVANCE_AMOUNT} (pending staff verification)`,
    `Remaining after video: Rs ${quote.remaining.toLocaleString()}`,
    `Name: ${customer.name || ''}`,
    `City: ${customer.city || ''}`,
    `Phone: ${customer.phone || ''}`,
    `Address: ${customer.address || ''}`,
    'Complete order ready karke VIDEO share hoga; remaining payment video ke baad.',
  ].join('\n');
}

export async function runSalarOrder({ conversationId, action }: { conversationId: string; action: SalarOrderAction }) {
  if (!conversationId) return { ok: false, reason: 'conversation_required' };
  const db = getAdminDb();
  const conversationRef = db.collection('salar_conversations').doc(conversationId);
  const conversationSnap = await conversationRef.get();
  if (!conversationSnap.exists) return { ok: false, reason: 'conversation_not_found' };
  const conversation: any = conversationSnap.data() || {};
  if (conversation.blocked === true) return { ok: false, reason: 'blocked' };
  const draft: any = conversation.order_draft || {};
  const draftItems: DraftItem[] = Array.isArray(draft.items) ? draft.items : [];
  if (!draftItems.length) return { ok: false, reason: 'items_missing' };

  let items: AuthoritativeItem[];
  try { items = await authoritativeItems(draftItems); }
  catch (error) { return { ok: false, reason: error instanceof Error ? error.message : 'order_quote_failed' }; }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const delivery = calculateDeliveryCharge(items.map((item) => ({ quantity: item.quantity, isWholesale: item.isWholesale, category: item.category, categoryId: item.categoryId })));
  const total = subtotal + delivery.deliveryCharge;
  const quote = {
    items,
    subtotal,
    rawSubtotal: subtotal,
    deliveryCharge: delivery.deliveryCharge,
    deliveryBreakdown: delivery,
    total,
    advanceAmount: ADVANCE_AMOUNT,
    remaining: Math.max(0, total - ADVANCE_AMOUNT),
    currency: 'PKR',
  };
  if (action === 'quote') return { ok: true, ...quote };

  const customer: CustomerDraft = draft.customer || {};
  const screenshotUrl = String(draft.advance_screenshot_url || '').trim();
  const complete = Boolean(customer.name && customer.city && customer.phone && customer.address && screenshotUrl && draft.advance_screenshot_at);
  if (!complete) return { ok: false, reason: 'summary_incomplete' };

  const key = fingerprint(conversationId, items);
  const orderId = `salar_${key}`;
  const orderRef = db.collection('orders').doc(orderId);
  const existing = await orderRef.get();
  let orderData: any;

  if (existing.exists) {
    orderData = existing.data() || {};
  } else {
    const now = new Date();
    orderData = {
      id: orderId,
      idempotencyKey: `salar:${conversationId}:${key}`,
      customer: { name: String(customer.name), phone: String(customer.phone), city: String(customer.city), address: String(customer.address) },
      items: items.map((item) => ({ productId: item.productId, title: item.title, quantity: item.quantity, price: item.price, lineTotal: item.lineTotal, variantKey: item.variantKey || null })),
      rawSubtotal: subtotal,
      subtotal,
      deliveryCharge: delivery.deliveryCharge,
      total,
      currency: 'PKR',
      status: 'pending',
      source: 'salar',
      conversation_id: conversationId,
      send_video_after_advance: true,
      advance_amount: ADVANCE_AMOUNT,
      advance_status: 'pending_verify',
      advance_screenshot_url: screenshotUrl,
      advance_screenshot_at: String(draft.advance_screenshot_at),
      notes: {
        source: 'salar',
        conversation_id: conversationId,
        send_video_after_advance: true,
        advance_amount: ADVANCE_AMOUNT,
        advance_status: 'pending_verify',
        advance_screenshot_url: screenshotUrl,
      },
      createdAt: now,
      updatedAt: now,
    };
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(orderRef);
      if (!fresh.exists) transaction.set(orderRef, orderData);
    });
    const mirror = await mirrorSupabaseUpsert({ table: 'orders', row: mapOrderToSupabase(orderId, orderData), conflict: 'id' });
    if (!mirror.ok) await recordMirrorFailure('orders', orderId, 'upsert', mapOrderToSupabase(orderId, orderData));
  }

  const number = await whatsappNumber();
  const whatsappUrl = number ? `https://wa.me/${number}?text=${encodeURIComponent(summaryText(orderId, quote, customer))}` : '';
  await conversationRef.set({
    order_draft: { ...draft, stage: 'complete', order_id: orderId, whatsapp_url: whatsappUrl, updated_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }, { merge: true });

  return { ok: true, orderId, whatsappUrl, ...quote, alreadyExists: existing.exists };
}
