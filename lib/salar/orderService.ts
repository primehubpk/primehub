import 'server-only';

import { createHash } from 'crypto';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { calculateDeliveryCharge } from '@/lib/deliveryCharges';
import { isWholesaleProduct } from '@/lib/wholesale';
import { mapOrderToSupabase, mirrorSupabaseUpsert, recordMirrorFailure } from '@/lib/dualWriteServer';

const ADVANCE_AMOUNT = 300;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
type Weekday = (typeof WEEKDAYS)[number];
type SalarOrderAction = 'quote' | 'commit';
type DraftItem = { productId?: string; id?: string; quantity?: number; qty?: number; variantKey?: string | null };
type CustomerDraft = { name?: string; city?: string; phone?: string; address?: string };
type AuthoritativeItem = { productId: string; title: string; quantity: number; price: number; lineTotal: number; variantKey?: string | null; isWholesale?: unknown; category?: unknown; categoryId?: unknown };

function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function qty(value: unknown) { return Math.max(1, Math.min(50, Math.floor(numberValue(value) || 1))); }
function cleanPhone(value: unknown) { return String(value || '').replace(/\D/g, ''); }
function pakistanWeekday(): Weekday {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase();
  return (WEEKDAYS.includes(day as Weekday) ? day : 'sunday') as Weekday;
}
function normalizeWhatsappNumber(value: unknown) {
  let digits = cleanPhone(value); if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith('3')) digits = `92${digits}`;
  return /^\d{10,15}$/.test(digits) ? digits : '';
}
function variantRows(product: any) {
  return [...(Array.isArray(product?.variantMatrix) ? product.variantMatrix : []), ...(Array.isArray(product?.variants) ? product.variants : [])];
}
function selectedVariant(product: any, variantKey?: string | null) {
  const rows = variantRows(product); if (!rows.length) return null;
  if (!variantKey) return rows[0];
  return rows.find((row: any) => String(row?.key || row?.id || row?.name || '') === variantKey) || rows[0];
}

async function authoritativeItems(items: DraftItem[]): Promise<AuthoritativeItem[]> {
  const db = getAdminDb();
  const currentDay = pakistanWeekday();
  const settingsSnap = await db.collection('settings').doc('main').get();
  const settings: any = settingsSnap.exists ? settingsSnap.data() || {} : {};
  const weeklyDeals = Array.isArray(settings.weeklyDeals) ? settings.weeklyDeals : [];
  const liveDeal = weeklyDeals.find((deal: any) => deal?.day === currentDay && deal?.active !== false && typeof deal?.productId === 'string' && numberValue(deal?.dealPrice) > 0);
  const output: AuthoritativeItem[] = [];
  for (const input of items) {
    const productId = String(input.productId || input.id || '').trim();
    if (!productId) throw new Error('ORDER_ITEMS_MISSING');
    const snap = await db.collection('products').doc(productId).get();
    if (!snap.exists) throw new Error('ORDER_PRODUCT_MISSING');
    const product: any = { id: snap.id, ...(snap.data() || {}) };
    if (product.active === false) throw new Error('ORDER_PRODUCT_UNAVAILABLE');
    const quantity = qty(input.quantity ?? input.qty);
    const variant: any = selectedVariant(product, input.variantKey || null);
    const rawStock = variant?.stock ?? product.stock ?? product.quantity;
    const stockProvided = rawStock !== undefined && rawStock !== null && rawStock !== '';
    if (stockProvided && numberValue(rawStock) <= 0) throw new Error('ORDER_PRODUCT_UNAVAILABLE');
    const regularPrice = numberValue(product.price);
    const liveDealPrice = liveDeal?.productId === productId ? numberValue(liveDeal.dealPrice) : 0;
    const isLiveDealItem = liveDealPrice > 0 && liveDealPrice < regularPrice;
    const price = isLiveDealItem ? liveDealPrice : (variant && numberValue(variant.price) > 0 ? numberValue(variant.price) : regularPrice);
    if (price <= 0) throw new Error('ORDER_PRICE_INVALID');
    output.push({
      productId, title: String(product.title || product.name || productId), quantity, price, lineTotal: price * quantity,
      variantKey: input.variantKey || null, isWholesale: isWholesaleProduct(product), category: product.category || '', categoryId: product.categoryId || '',
    });
  }
  return output;
}

async function whatsappNumber() {
  const envNumber = normalizeWhatsappNumber(process.env.WHATSAPP_BUSINESS_NUMBER); if (envNumber) return envNumber;
  const db = getAdminDb();
  for (const id of ['main', 'contact']) {
    const snap = await db.collection('settings').doc(id).get(); if (!snap.exists) continue;
    const data: any = snap.data() || {}; const contact = data.contact && typeof data.contact === 'object' ? data.contact : {};
    const candidates = [data.adminWhatsappNumber, data.whatsappNumber, data.whatsapp, data.whatsappPhone, data.phone, contact.whatsappNumber, contact.whatsapp, contact.phone];
    for (const value of candidates) { const number = normalizeWhatsappNumber(value); if (number) return number; }
  }
  return '';
}
function fingerprint(conversationId: string, items: AuthoritativeItem[]) {
  const basis = items.map((item) => `${item.productId}:${item.variantKey || ''}:${item.quantity}`).sort().join('|');
  return createHash('sha256').update(`${conversationId}|${basis}`).digest('hex').slice(0, 24);
}
function summaryText(orderId: string, quote: any, customer: CustomerDraft) {
  const lines = quote.items.map((item: AuthoritativeItem) => `${item.title} x${item.quantity} — Rs ${item.lineTotal.toLocaleString()}`);
  return [`PrimeHub Salar Order #${orderId.slice(-8)}`, ...lines, `Subtotal: Rs ${quote.subtotal.toLocaleString()}`, `Delivery: Rs ${quote.deliveryCharge.toLocaleString()}`, `Total: Rs ${quote.total.toLocaleString()}`, `Advance screenshot: Rs ${ADVANCE_AMOUNT} (pending staff verification)`, `Remaining after video: Rs ${quote.remaining.toLocaleString()}`, `Name: ${customer.name || ''}`, `City: ${customer.city || ''}`, `Phone: ${customer.phone || ''}`, `Address: ${customer.address || ''}`, 'Complete order ready karke VIDEO share hoga; remaining payment video ke baad.'].join('\n');
}

export async function runSalarOrder({ conversationId, action }: { conversationId: string; action: SalarOrderAction }) {
  if (!conversationId) return { ok: false, reason: 'conversation_required' };
  const db = getAdminDb(); const conversationRef = db.collection('salar_conversations').doc(conversationId); const conversationSnap = await conversationRef.get();
  if (!conversationSnap.exists) return { ok: false, reason: 'conversation_not_found' };
  const conversation: any = conversationSnap.data() || {}; if (conversation.blocked === true) return { ok: false, reason: 'blocked' };
  const draft: any = conversation.order_draft || {}; const draftItems: DraftItem[] = Array.isArray(draft.items) ? draft.items : [];
  if (!draftItems.length) return { ok: false, reason: 'items_missing' };

  let items: AuthoritativeItem[];
  try { items = await authoritativeItems(draftItems); } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : 'order_quote_failed' }; }
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const delivery = calculateDeliveryCharge(items.map((item) => ({ quantity: item.quantity, isWholesale: item.isWholesale, category: item.category, categoryId: item.categoryId })));
  const total = subtotal + delivery.deliveryCharge;
  const quote = { items, rawSubtotal: subtotal, subtotal, deliveryCharge: delivery.deliveryCharge, deliveryBreakdown: delivery, total, advanceAmount: ADVANCE_AMOUNT, remaining: Math.max(0, total - ADVANCE_AMOUNT), currency: 'PKR' };
  if (action === 'quote') return { ok: true, ...quote };

  const customer: CustomerDraft = draft.customer || {}; const screenshotUrl = String(draft.advance_screenshot_url || '').trim();
  const complete = Boolean(customer.name && customer.city && customer.phone && customer.address && screenshotUrl && draft.advance_screenshot_at);
  if (!complete) return { ok: false, reason: 'summary_incomplete' };

  const key = fingerprint(conversationId, items); const orderId = `salar_${key}`; const orderRef = db.collection('orders').doc(orderId); const existing = await orderRef.get();
  let orderData: any = existing.exists ? existing.data() || {} : null;
  if (!existing.exists) {
    const now = new Date();
    orderData = {
      id: orderId, idempotencyKey: `salar:${conversationId}:${key}`,
      customer: { name: String(customer.name), phone: String(customer.phone), email: '', city: String(customer.city), address: String(customer.address), notes: 'Salar order — advance screenshot pending staff verification.' },
      items: items.map((item) => ({ productId: item.productId, title: item.title, quantity: item.quantity, price: item.price, lineTotal: item.lineTotal, variantKey: item.variantKey || null })),
      rawSubtotal: subtotal, subtotal, deliveryCharge: delivery.deliveryCharge, total, totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      baseDelivery: delivery.baseDelivery, wholesaleItems: delivery.wholesaleItems, wholesaleSurcharge: delivery.wholesaleSurcharge,
      selfCollect: false, fulfillment: 'delivery', currency: 'PKR', status: 'pending', source: 'salar', conversation_id: conversationId,
      send_video_after_advance: true, advance_amount: ADVANCE_AMOUNT, advance_status: 'pending_verify', advance_screenshot_url: screenshotUrl, advance_screenshot_at: String(draft.advance_screenshot_at),
      notes: { source: 'salar', conversation_id: conversationId, send_video_after_advance: true, advance_amount: ADVANCE_AMOUNT, advance_status: 'pending_verify', advance_screenshot_url: screenshotUrl },
      createdAt: now, updatedAt: now,
    };
    await db.runTransaction(async (transaction) => { const fresh = await transaction.get(orderRef); if (!fresh.exists) transaction.set(orderRef, orderData); });
    const supabaseRow = mapOrderToSupabase(orderId, orderData); const mirror = await mirrorSupabaseUpsert({ table: 'orders', row: supabaseRow });
    if (mirror.attempted && !mirror.ok) await recordMirrorFailure('orders', orderId, 'upsert', supabaseRow);
  }

  const number = await whatsappNumber(); const whatsappUrl = number ? `https://wa.me/${number}?text=${encodeURIComponent(summaryText(orderId, quote, customer))}` : '';
  await conversationRef.set({ order_draft: { ...draft, stage: 'complete', order_id: orderId, whatsapp_url: whatsappUrl, updated_at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { merge: true });
  return { ok: true, orderId, whatsappUrl, ...quote, alreadyExists: existing.exists };
}
