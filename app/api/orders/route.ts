import { NextResponse } from 'next/server';
import { calculateDeliveryCharge } from '@/lib/deliveryCharges';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { isWholesaleProduct } from '@/lib/wholesale';

export const runtime = 'nodejs';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
type Weekday = (typeof WEEKDAYS)[number];
type IncomingItem = { id?: string | number; productId?: string; name?: string; title?: string; price?: number; originalPrice?: number; image?: string; imageUrl?: string; qty?: number; quantity?: number; dealDay?: Weekday; variant?: { color?: string; size?: string } };
type Customer = { name: string; phone: string; email?: string; address: string; city: string; notes?: string };

function pakistanWeekday(): Weekday {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase();
  return (WEEKDAYS.includes(day as Weekday) ? day : 'sunday') as Weekday;
}
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function variantValue(row: any, key: 'color' | 'size') {
  const direct = row?.[key] ?? row?.[`variant${key[0].toUpperCase()}${key.slice(1)}`];
  if (typeof direct === 'string' || typeof direct === 'number') return String(direct).trim().toLowerCase();
  if (row?.options && typeof row.options === 'object') {
    const value = row.options[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim().toLowerCase();
  }
  return '';
}
function findVariant(product: any, item: IncomingItem) {
  const rows = [...(Array.isArray(product.variantMatrix) ? product.variantMatrix : []), ...(Array.isArray(product.variants) ? product.variants : [])];
  if (!rows.length) return null;
  const variant = item.variant || {};
  const wantedColor = variant.color ? String(variant.color).trim().toLowerCase() : '';
  const wantedSize = variant.size ? String(variant.size).trim().toLowerCase() : '';
  return rows.find((row: any) => (!wantedColor || variantValue(row, 'color') === wantedColor) && (!wantedSize || variantValue(row, 'size') === wantedSize)) || rows[0];
}
async function buildAuthoritativeItems(items: IncomingItem[]) {
  const adminDb = getAdminDb();
  const currentDay = pakistanWeekday();
  const settingsSnap = await adminDb.collection('settings').doc('main').get();
  const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
  const weeklyDeals = Array.isArray(settings.weeklyDeals) ? settings.weeklyDeals : [];
  const liveDeal = weeklyDeals.find((deal: any) => deal?.day === currentDay && deal?.active !== false && typeof deal?.productId === 'string' && numberValue(deal?.dealPrice) > 0);
  const uniqueIds = [...new Set(items.map(item => String(item.productId || item.id || '')).filter(Boolean))];
  if (!uniqueIds.length) throw new Error('Cart does not contain valid product IDs.');
  const productDocs = await Promise.all(uniqueIds.map(id => adminDb.collection('products').doc(id).get()));
  const products = new Map(productDocs.map(snapshot => [snapshot.id, snapshot]));
  return items.map(item => {
    const productId = String(item.productId || item.id || '');
    const snapshot = products.get(productId);
    if (!snapshot?.exists) throw new Error(`Product ${productId} is no longer available.`);
    const product: any = { id: snapshot.id, ...(snapshot.data() || {}) };
    const variant: any = findVariant(product, item);
    const rawStock = variant?.stock ?? product.stock ?? product.quantity;
    const stockProvided = rawStock !== undefined && rawStock !== null && rawStock !== '';
    if (stockProvided && numberValue(rawStock) <= 0) throw new Error(`${product.title || product.name || 'This product'} is currently unavailable.`);
    const regularPrice = numberValue(product.price);
    const liveDealPrice = liveDeal?.productId === productId ? numberValue(liveDeal.dealPrice) : 0;
    const isLiveDealItem = liveDealPrice > 0 && liveDealPrice < regularPrice;
    const price = isLiveDealItem ? liveDealPrice : (variant && numberValue(variant.price) > 0 ? numberValue(variant.price) : regularPrice);
    if (price <= 0) throw new Error('Product price is not available.');
    const quantity = Math.max(1, Math.min(50, Math.floor(numberValue(item.quantity ?? item.qty ?? 1))));
    return {
      productId,
      title: String(product.title || product.name || item.title || item.name || 'Product'),
      price,
      originalPrice: numberValue(product.originalPrice) > regularPrice ? numberValue(product.originalPrice) : regularPrice,
      quantity,
      image: String(variant?.imageUrl || product.imageUrl || product.image || item.imageUrl || item.image || ''),
      variant: item.variant || null,
      weeklyDealDay: isLiveDealItem ? currentDay : null,
      isWholesale: isWholesaleProduct(product),
      category: product.category || '',
      categoryId: product.categoryId || '',
    };
  });
}
async function optionalReseller(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(header.slice(7));
    const profile = await getAdminDb().collection('reseller_profiles').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.status !== 'active') return null;
    const data = profile.data() || {};
    const settingsSnap = await getAdminDb().collection('settings').doc('main').get();
    const configured = Array.isArray(settingsSnap.data()?.resellerTiers) ? settingsSnap.data()?.resellerTiers : [];
    const tiers = configured.length === 4 ? configured : [
      { id: 'starter', minMonthlyOrders: 0, discountPercent: 0 }, { id: 'prime', minMonthlyOrders: 10, discountPercent: 2 },
      { id: 'pro', minMonthlyOrders: 20, discountPercent: 5 }, { id: 'elite', minMonthlyOrders: 30, discountPercent: 8 },
    ];
    const monthlyOrders = Math.max(0, Number(data.monthlyOrders || 0));
    const tier = [...tiers].sort((a:any,b:any)=>Number(b.minMonthlyOrders)-Number(a.minMonthlyOrders)).find((item:any)=>monthlyOrders>=Number(item.minMonthlyOrders)) || tiers[0];
    return { userId: decoded.uid, tierId: String(tier.id || 'starter'), tierName: String(tier.name || 'Starter'), discountPercent: Math.min(100, Math.max(0, Number(tier.discountPercent || 0))) };
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawItems = Array.isArray(body?.items) ? body.items as IncomingItem[] : [];
    const quoteOnly = body?.mode === 'quote';
    const selfCollect = body?.selfCollect === true;
    if (!rawItems.length || rawItems.length > 50) return NextResponse.json({ error: 'Your cart is empty or contains too many items.' }, { status: 400 });
    const items = await buildAuthoritativeItems(rawItems);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const rawSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const reseller = await optionalReseller(request);
    const tierDiscountPercent = reseller?.discountPercent || 0;
    const tierDiscount = Math.round(rawSubtotal * tierDiscountPercent / 100);
    const subtotal = Math.max(0, rawSubtotal - tierDiscount);
    const delivery = selfCollect ? { baseDelivery: 0, wholesaleItems: 0, wholesaleSurcharge: 0, deliveryCharge: 0 } : calculateDeliveryCharge(items);
    const total = subtotal + delivery.deliveryCharge;
    const quote = { items, rawSubtotal, tierDiscount, tierDiscountPercent, resellerTier: reseller?.tierName || '', subtotal, totalItems, ...delivery, total, selfCollect, fulfillment: selfCollect ? 'self_collect' : 'delivery' };
    if (quoteOnly) return NextResponse.json(quote);
    const customer = body?.customer as Customer | undefined;
    if (!customer?.name?.trim() || !customer?.phone?.trim() || (!selfCollect && (!customer?.address?.trim() || !customer?.city?.trim()))) return NextResponse.json({ error: selfCollect ? 'Name and phone are required.' : 'Name, phone, address and city are required.' }, { status: 400 });
    const resellerUserId = reseller?.userId || '';
    const orderData: any = {
      customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: String(customer.email || '').trim(), address: selfCollect ? 'PrimeHub Shop Pickup' : customer.address.trim(), city: selfCollect ? 'Lahore' : customer.city.trim(), notes: String(customer.notes || '').trim() },
      ...quote,
      currency: 'PKR', status: 'pending', source: 'website', createdAt: new Date(),
    };
    if (resellerUserId) orderData.resellerUserId = resellerUserId;
    const orderRef = await getAdminDb().collection('orders').add(orderData);
    return NextResponse.json({ orderId: orderRef.id, ...quote, resellerLinked: Boolean(resellerUserId) });
  } catch (error) {
    console.error('Secure order creation failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to place order.' }, { status: 400 });
  }
}

