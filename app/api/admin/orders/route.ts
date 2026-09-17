import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  getSupabasePrimaryPayload,
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
const LEGACY_CACHE_MS = 5 * 60 * 1000;

let legacyOrdersCache: Array<Record<string, any>> = [];
let legacyOrdersCacheAt = 0;

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === `${ADMIN_COOKIE}=true`);
}

function supabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
  };
}

async function listSupabaseOrders() {
  const { url, key } = supabaseConfig();
  if (!url || !key) return [] as Array<Record<string, any>>;

  const params = new URLSearchParams();
  params.set('select', 'id,payload,customer,items,raw_subtotal,subtotal,delivery_charge,total,currency,status,source,fulfillment,reseller_user_id,created_at,updated_at');
  params.set('order', 'created_at.desc');
  params.set('limit', '250');

  const response = await fetch(`${url}/rest/v1/orders?${params.toString()}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`Supabase orders read failed ${response.status}`);
  }

  const rows = await response.json() as Array<Record<string, any>>;
  return rows.map((row) => {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return {
      ...payload,
      id: String(row.id || payload.id || ''),
      customer: row.customer && typeof row.customer === 'object' ? row.customer : (payload.customer || {}),
      items: Array.isArray(row.items) ? row.items : (Array.isArray(payload.items) ? payload.items : []),
      rawSubtotal: row.raw_subtotal ?? payload.rawSubtotal,
      subtotal: row.subtotal ?? payload.subtotal,
      deliveryCharge: row.delivery_charge ?? payload.deliveryCharge,
      total: row.total ?? payload.total,
      currency: row.currency ?? payload.currency,
      status: row.status ?? payload.status,
      source: row.source ?? payload.source,
      fulfillment: row.fulfillment ?? payload.fulfillment,
      resellerUserId: row.reseller_user_id ?? payload.resellerUserId,
      createdAt: payload.createdAt ?? row.created_at,
      updatedAt: payload.updatedAt ?? row.updated_at,
    };
  });
}

async function readLegacyFirebaseOrders() {
  const now = Date.now();
  if (legacyOrdersCache.length && now - legacyOrdersCacheAt < LEGACY_CACHE_MS) {
    return { orders: legacyOrdersCache, fromCache: true };
  }

  const snapshot = await getAdminDb().collection('orders').limit(250).get();
  const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  legacyOrdersCache = orders;
  legacyOrdersCacheAt = now;
  return { orders, fromCache: false };
}

async function backfillLegacyOrdersToSupabase(orders: Array<Record<string, any>>, knownIds: Set<string>) {
  if (!isSupabaseWriteConfigured()) return;
  const missing = orders.filter((order) => order.id && !knownIds.has(String(order.id))).slice(0, 100);
  if (!missing.length) return;

  await Promise.allSettled(missing.map(async (order) => {
    const row = {
      ...mapOrderToSupabase(String(order.id), order),
      authoritative_source: 'supabase',
      mirror_status: 'synced',
      mirror_error: null,
    };
    await supabasePrimaryUpsert({ table: 'orders', row });
  }));
}

function mergeOrders(primary: Array<Record<string, any>>, legacy: Array<Record<string, any>>) {
  const merged = new Map<string, Record<string, any>>();
  for (const order of legacy) {
    if (order?.id) merged.set(String(order.id), order);
  }
  for (const order of primary) {
    if (order?.id) merged.set(String(order.id), { ...(merged.get(String(order.id)) || {}), ...order });
  }
  return [...merged.values()];
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let supabaseOrders: Array<Record<string, any>> = [];
  let legacyOrders: Array<Record<string, any>> = [];
  let warning = '';

  if (isSupabaseWriteConfigured()) {
    try {
      supabaseOrders = await listSupabaseOrders();
    } catch (error) {
      warning = error instanceof Error ? error.message : 'Supabase orders could not be loaded.';
    }
  }

  try {
    const legacy = await readLegacyFirebaseOrders();
    legacyOrders = legacy.orders;
    if (isSupabaseWriteConfigured() && legacyOrders.length) {
      void backfillLegacyOrdersToSupabase(legacyOrders, new Set(supabaseOrders.map((order) => String(order.id))));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const quotaExceeded = /RESOURCE_EXHAUSTED|quota exceeded/i.test(message);
    warning = warning || (quotaExceeded
      ? 'Firebase legacy order sync is temporarily unavailable because its quota is exhausted. Supabase orders are still available.'
      : 'Legacy Firebase orders could not be refreshed. Supabase orders are still available.');
  }

  const orders = mergeOrders(supabaseOrders, legacyOrders);
  if (!orders.length && warning) {
    return NextResponse.json({ error: warning }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    orders,
    primary: isSupabaseWriteConfigured() ? 'supabase' : 'firebase',
    warning: warning || null,
  });
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

      if (isSupabaseWriteConfigured()) {
        let existing: Record<string, any> | null = null;
        try {
          existing = await getSupabasePrimaryPayload('orders', orderId);
        } catch {
          existing = null;
        }

        if (!existing) {
          try {
            const snapshot = await orderRef.get();
            if (!snapshot.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
            existing = snapshot.data() || {};
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/RESOURCE_EXHAUSTED|quota exceeded/i.test(message)) {
              return NextResponse.json({ error: 'This is a legacy Firebase-only order. Firebase quota is currently exhausted, so its status cannot be changed until Firebase is available again.' }, { status: 503 });
            }
            throw error;
          }
        }

        const nextOrder = { ...existing, status, updatedAt: new Date().toISOString() };
        const row = {
          ...mapOrderToSupabase(orderId, nextOrder),
          authoritative_source: 'supabase',
          mirror_status: 'synced',
          mirror_error: null,
        };
        await supabasePrimaryUpsert({ table: 'orders', row });

        try {
          await orderRef.set({ status, updatedAt: new Date() }, { merge: true });
        } catch (error) {
          const warning = error instanceof Error ? error.message : String(error);
          await recordMirrorFailure('orders', orderId, 'upsert', { status }, 'firebase');
          return NextResponse.json({ success: true, primary: 'supabase', mirrorWarning: warning });
        }

        legacyOrdersCache = legacyOrdersCache.map((order) => order.id === orderId ? { ...order, status } : order);
        return NextResponse.json({ success: true, primary: 'supabase' });
      }

      const snapshot = await orderRef.get();
      if (!snapshot.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      await orderRef.update({ status, updatedAt: new Date() });
      legacyOrdersCache = legacyOrdersCache.map((order) => order.id === orderId ? { ...order, status } : order);
      return NextResponse.json({ success: true, primary: 'firebase' });
    }

    if (action === 'delete') {
      if (isSupabaseWriteConfigured()) {
        let existsInSupabase = false;
        try {
          existsInSupabase = Boolean(await getSupabasePrimaryPayload('orders', orderId));
        } catch {
          existsInSupabase = false;
        }

        if (existsInSupabase) {
          await supabasePrimaryDelete({ table: 'orders', id: orderId });
          try {
            await orderRef.delete();
          } catch (error) {
            const warning = error instanceof Error ? error.message : String(error);
            await recordMirrorFailure('orders', orderId, 'delete', {}, 'firebase');
            legacyOrdersCache = legacyOrdersCache.filter((order) => order.id !== orderId);
            return NextResponse.json({ success: true, primary: 'supabase', mirrorWarning: warning });
          }
          legacyOrdersCache = legacyOrdersCache.filter((order) => order.id !== orderId);
          return NextResponse.json({ success: true, primary: 'supabase' });
        }

        try {
          const snapshot = await orderRef.get();
          if (!snapshot.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
          await orderRef.delete();
          legacyOrdersCache = legacyOrdersCache.filter((order) => order.id !== orderId);
          return NextResponse.json({ success: true, primary: 'firebase-legacy' });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/RESOURCE_EXHAUSTED|quota exceeded/i.test(message)) {
            return NextResponse.json({ error: 'This is a legacy Firebase-only order. Firebase quota is currently exhausted, so it cannot be deleted until Firebase is available again.' }, { status: 503 });
          }
          throw error;
        }
      }

      await orderRef.delete();
      legacyOrdersCache = legacyOrdersCache.filter((order) => order.id !== orderId);
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
