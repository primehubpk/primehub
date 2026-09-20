import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '',
  ).trim();
  if (!url || !key) throw new Error('Supabase order tracking is not configured.');
  return { url, key };
}

async function readSupabaseOrders(phone: string) {
  const { url, key } = supabaseConfig();
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('customer->>phone', `eq.${phone}`);
  params.set('order', 'created_at.desc');
  params.set('limit', '50');

  const response = await fetch(`${url}/rest/v1/orders?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Supabase order tracking failed ${response.status}`);

  const rows = await response.json() as any[];
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
    return {
      ...payload,
      id: row.id,
      customer: row.customer ?? payload.customer,
      items: row.items ?? payload.items,
      rawSubtotal: row.raw_subtotal ?? payload.rawSubtotal,
      subtotal: row.subtotal ?? payload.subtotal,
      deliveryCharge: row.delivery_charge ?? payload.deliveryCharge,
      total: row.total ?? payload.total,
      currency: row.currency ?? payload.currency,
      status: row.status ?? payload.status,
      source: row.source ?? payload.source,
      fulfillment: row.fulfillment ?? payload.fulfillment,
      createdAt: row.created_at ?? payload.createdAt,
      updatedAt: row.updated_at ?? payload.updatedAt,
    };
  });
}

async function readFirebaseOrders(phone: string) {
  const snap = await getAdminDb()
    .collection('orders')
    .where('customer.phone', '==', phone)
    .limit(50)
    .get();

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = String(searchParams.get('phone') || searchParams.get('q') || '').trim();

    if (!phone) {
      return NextResponse.json({ orders: [] }, { status: 200 });
    }

    try {
      const orders = await readSupabaseOrders(phone);
      return NextResponse.json({ orders, source: 'supabase' }, { status: 200 });
    } catch (primaryError) {
      console.warn(
        'Supabase order tracking failed; Firebase recovery allowed.',
        primaryError instanceof Error ? primaryError.message : 'unknown',
      );
      const orders = await readFirebaseOrders(phone);
      return NextResponse.json({ orders, source: 'firebase-fallback' }, { status: 200 });
    }
  } catch (error) {
    console.error('Error tracking order:', error);
    return NextResponse.json({ orders: [], error: 'Failed to track order' }, { status: 500 });
  }
}
