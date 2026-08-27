import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { ResellerTierId } from '@/lib/resellerTypes';

export const runtime = 'nodejs';

type Customer = { name?: string; phone?: string; email?: string; address?: string; city?: string; notes?: string };

type Item = { productId?: string; id?: string | number; title?: string; name?: string; price?: number; quantity?: number; qty?: number; variant?: { color?: string; size?: string } };

function resellerCode(uid: string) { return `PH-RS-${uid.slice(-6).toUpperCase()}`; }
function num(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

async function authReseller(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Please sign in to the Reseller Club first.');
  const decoded = await getAdminAuth().verifyIdToken(header.slice(7));
  const profile = await getAdminDb().collection('reseller_profiles').doc(decoded.uid).get();
  if (!profile.exists || profile.data()?.status !== 'active') throw new Error('Active reseller membership is required.');
  return { uid: decoded.uid, profile: profile.data() || {} };
}

export async function POST(request: Request) {
  try {
    const { uid, profile } = await authReseller(request);
    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items as Item[] : [];
    const customer = (body?.customer || {}) as Customer;
    if (!items.length) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
    if (!customer.name?.trim() || !customer.phone?.trim()) return NextResponse.json({ error: 'Customer name and phone are required for a WhatsApp reseller request.' }, { status: 400 });

    const total = items.reduce((sum, item) => sum + num(item.price) * Math.max(1, num(item.quantity ?? item.qty ?? 1)), 0);
    const code = resellerCode(uid);
    const ref = await getAdminDb().collection('reseller_whatsapp_orders').add({
      resellerUserId: uid,
      resellerCode: code,
      resellerEmail: String(profile.email || ''),
      resellerTierId: String(profile.tierId || 'starter') as ResellerTierId,
      customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: String(customer.email || '').trim(), address: String(customer.address || '').trim(), city: String(customer.city || '').trim(), notes: String(customer.notes || '').trim() },
      items: items.map(item => ({ productId: String(item.productId || item.id || ''), title: String(item.title || item.name || 'Product'), quantity: Math.max(1, num(item.quantity ?? item.qty ?? 1)), price: num(item.price), variant: item.variant || null })),
      subtotal: total,
      status: 'pending',
      source: 'whatsapp',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return NextResponse.json({ requestId: ref.id, resellerCode: code, status: 'pending' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create WhatsApp reseller request.';
    return NextResponse.json({ error: message }, { status: message.includes('sign in') || message.includes('membership') ? 401 : 400 });
  }
}
