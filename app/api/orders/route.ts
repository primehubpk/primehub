import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
type Weekday = (typeof WEEKDAYS)[number];

type IncomingItem = {
  id?: string | number;
  productId?: string;
  name?: string;
  title?: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  imageUrl?: string;
  qty?: number;
  quantity?: number;
  dealDay?: Weekday;
};

type Customer = {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  notes?: string;
};

function pakistanWeekday(): Weekday {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'long',
  }).format(new Date()).toLowerCase();
  return (WEEKDAYS.includes(day as Weekday) ? day : 'sunday') as Weekday;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function buildAuthoritativeItems(items: IncomingItem[]) {
  const currentDay = pakistanWeekday();
  const settingsSnap = await adminDb.collection('settings').doc('main').get();
  const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
  const weeklyDeals = Array.isArray(settings.weeklyDeals) ? settings.weeklyDeals : [];
  const liveDeal = weeklyDeals.find(
    (deal: any) =>
      deal?.day === currentDay &&
      deal?.active !== false &&
      typeof deal?.productId === 'string' &&
      numberValue(deal?.dealPrice) > 0
  );

  const uniqueIds = [...new Set(items.map((item) => String(item.productId || item.id || '')).filter(Boolean))];
  if (!uniqueIds.length) throw new Error('Cart does not contain valid product IDs.');

  const productDocs = await Promise.all(
    uniqueIds.map((id) => adminDb.collection('products').doc(id).get())
  );
  const products = new Map(productDocs.map((snap) => [snap.id, snap]));

  return items.map((item) => {
    const productId = String(item.productId || item.id || '');
    const snap = products.get(productId);
    if (!snap?.exists) throw new Error(`Product ${productId} is no longer available.`);

    const product = snap.data() || {};
    const stock = numberValue(product.stock ?? product.quantity);
    if (stock <= 0) throw new Error(`${product.title || product.name || 'This product'} is currently unavailable.`);

    const regularPrice = numberValue(product.price);
    const isLiveDealItem =
      item.dealDay === currentDay &&
      liveDeal?.productId === productId;
    const authoritativePrice = isLiveDealItem ? numberValue(liveDeal.dealPrice) : regularPrice;

    if (authoritativePrice <= 0) throw new Error('Product price is not available.');

    const quantity = Math.max(1, Math.min(50, Math.floor(numberValue(item.quantity ?? item.qty ?? 1))));
    const title = String(product.title || product.name || item.title || item.name || 'Product');
    const image = String(product.imageUrl || product.image || item.imageUrl || item.image || '');
    const originalPrice = numberValue(product.originalPrice) > regularPrice
      ? numberValue(product.originalPrice)
      : regularPrice;

    return {
      productId,
      title,
      price: authoritativePrice,
      originalPrice,
      quantity,
      image,
      weeklyDealDay: isLiveDealItem ? currentDay : null,
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customer = body?.customer as Customer | undefined;
    const rawItems = Array.isArray(body?.items) ? (body.items as IncomingItem[]) : [];

    if (!customer?.name?.trim() || !customer?.phone?.trim() || !customer?.address?.trim() || !customer?.city?.trim()) {
      return NextResponse.json({ error: 'Name, phone, address and city are required.' }, { status: 400 });
    }
    if (!rawItems.length || rawItems.length > 50) {
      return NextResponse.json({ error: 'Your cart is empty or contains too many items.' }, { status: 400 });
    }

    const items = await buildAuthoritativeItems(rawItems);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const orderRef = await adminDb.collection('orders').add({
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: String(customer.email || '').trim(),
        address: customer.address.trim(),
        city: customer.city.trim(),
        notes: String(customer.notes || '').trim(),
      },
      items,
      totalItems,
      subtotal,
      total: subtotal,
      currency: 'PKR',
      status: 'pending',
      source: 'website',
      createdAt: new Date(),
    });

    return NextResponse.json({ orderId: orderRef.id, items, subtotal, totalItems });
  } catch (error) {
    console.error('Secure order creation failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to place order.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
