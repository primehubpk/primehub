// ==================== SECURE CUSTOMER ORDER TRACKER API ====================
// Verifies order ID + customer phone server-side and returns only safe fields.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizePhone(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function toIsoDate(value: unknown) {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { orderId: rawOrderId, phone: rawPhone } = await request.json();
    const orderId = String(rawOrderId || '').trim();
    const phone = normalizePhone(rawPhone);

    if (!/^[A-Za-z0-9]{12,64}$/.test(orderId) || phone.length < 7) {
      return NextResponse.json({ error: 'Enter a valid order ID and phone number.' }, { status: 400 });
    }

    const snapshot = await adminDb.collection('orders').doc(orderId).get();
    const order = snapshot.data();

    if (!snapshot.exists || normalizePhone(order?.customer?.phone) !== phone) {
      return NextResponse.json({ error: 'Order details do not match.' }, { status: 404 });
    }

    const createdAt = toIsoDate(order?.createdAt);
    const estimatedDeliveryDate = toIsoDate(order?.estimatedDeliveryAt) || (
      createdAt ? new Date(new Date(createdAt).getTime() + 5 * 86400000).toISOString() : null
    );

    return NextResponse.json({
      order: {
        id: snapshot.id,
        status: String(order?.status || 'pending'),
        totalItems: Number(order?.totalItems || 0),
        total: Number(order?.total || order?.subtotal || 0),
        currency: String(order?.currency || 'PKR'),
        createdAt,
        estimatedDeliveryDate,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to track this order right now.' }, { status: 500 });
  }
}
