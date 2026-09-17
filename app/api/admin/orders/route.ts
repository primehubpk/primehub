import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  isSupabaseWriteConfigured,
  mapOrderToSupabase,
  recordMirrorFailure,
  supabasePrimaryDelete,
  supabasePrimaryUpsert,
} from '@/lib/dualWriteServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_COOKIE = 'primehub_admin_auth';
const ORDER_STATUSES = new Set(['pending', 'processing', 'shipped', 'delivered', 'cancelled']);

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === `${ADMIN_COOKIE}=true`);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = String(body?.action || '');
    const orderId = String(body?.orderId || '').trim();

    if (!orderId) {
      return NextResponse.json({ error: 'Order id is required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    if (action === 'status') {
      const status = String(body?.status || '').toLowerCase();
      if (!ORDER_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Invalid order status.' }, { status: 400 });
      }

      const snapshot = await orderRef.get();
      if (!snapshot.exists) {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }

      const nextOrder = {
        ...(snapshot.data() || {}),
        status,
        updatedAt: new Date(),
      };

      if (isSupabaseWriteConfigured()) {
        const row = {
          ...mapOrderToSupabase(orderId, nextOrder),
          authoritative_source: 'supabase',
          mirror_status: 'synced',
          mirror_error: null,
        };
        await supabasePrimaryUpsert({ table: 'orders', row });

        try {
          await orderRef.update({ status, updatedAt: new Date() });
        } catch (error) {
          const warning = error instanceof Error ? error.message : String(error);
          await recordMirrorFailure('orders', orderId, 'upsert', { status }, 'firebase');
          return NextResponse.json({ success: true, primary: 'supabase', mirrorWarning: warning });
        }

        return NextResponse.json({ success: true, primary: 'supabase' });
      }

      await orderRef.update({ status, updatedAt: new Date() });
      return NextResponse.json({ success: true, primary: 'firebase' });
    }

    if (action === 'delete') {
      if (isSupabaseWriteConfigured()) {
        await supabasePrimaryDelete({ table: 'orders', id: orderId });

        try {
          await orderRef.delete();
        } catch (error) {
          const warning = error instanceof Error ? error.message : String(error);
          await recordMirrorFailure('orders', orderId, 'delete', {}, 'firebase');
          return NextResponse.json({ success: true, primary: 'supabase', mirrorWarning: warning });
        }

        return NextResponse.json({ success: true, primary: 'supabase' });
      }

      await orderRef.delete();
      return NextResponse.json({ success: true, primary: 'firebase' });
    }

    return NextResponse.json({ error: 'Unsupported order action.' }, { status: 400 });
  } catch (error) {
    console.error('Admin order action failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin order action failed.' },
      { status: 500 },
    );
  }
}
