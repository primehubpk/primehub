import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  getSupabasePrimaryPayload,
  isSupabaseWriteConfigured,
  mapDocumentToSupabase,
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
const ORDER_WHATSAPP_SETTING_ID = 'orders_whatsapp_forwarding';

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

async function readOrderWhatsappNumber() {
  if (isSupabaseWriteConfigured()) {
    const { url, key } = supabaseConfig();
    const params = new URLSearchParams({
      id: `eq.${ORDER_WHATSAPP_SETTING_ID}`,
      select: 'payload',
      limit: '1',
    });
    const response = await fetch(`${url}/rest/v1/settings?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`Supabase order WhatsApp setting read failed ${response.status}`);
    const rows = await response.json() as Array<{ payload?: Record<string, unknown> }>;
    return typeof rows?.[0]?.payload?.whatsappNumber === 'string' ? String(rows[0].payload.whatsappNumber).trim() : '';
  }

  const snapshot = await getAdminDb().collection('settings').doc(ORDER_WHATSAPP_SETTING_ID).get();
  return snapshot.exists ? String(snapshot.data()?.whatsappNumber || '').trim() : '';
}

async function saveOrderWhatsappNumber(number: string) {
  const payload = { whatsappNumber: number, updatedAt: new Date().toISOString() };

  if (isSupabaseWriteConfigured()) {
    const row = mapDocumentToSupabase('settings', ORDER_WHATSAPP_SETTING_ID, payload, 'supabase');
    if (!row) throw new Error('Unable to map the Order WhatsApp setting for Supabase.');
    await supabasePrimaryUpsert({ table: 'settings', row: { ...row, authoritative_source: 'supabase', mirror_status: 'synced', mirror_error: null } });

    try {
      await getAdminDb().collection('settings').doc(ORDER_WHATSAPP_SETTING_ID).set(payload, { merge: true });
      return null;
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      await recordMirrorFailure('settings', ORDER_WHATSAPP_SETTING_ID, 'upsert', payload, 'firebase');
      return warning;
    }
  }

  await getAdminDb().collection('settings').doc(ORDER_WHATSAPP_SETTING_ID).set(payload, { merge: true });
  return null;
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
  if (!isSupabaseWriteConfigured()) return 0;
  const missing = orders.filter((order) => order.id && !knownIds.has(String(order.id))).slice(0, 100);
  if (!missing.length) return 0;

  let copied = 0;
  for (const order of missing) {
    const row = {
      ...mapOrderToSupabase(String(order.id), order),
      authoritative_source: 'supabase',
      mirror_status: 'synced',
      mirror_error: null,
    };
    await supabasePrimaryUpsert({ table: 'orders', row });
    copied += 1;
  }
  return copied;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if (isSupabaseWriteConfigured()) {
    try {
      const [orders, whatsappNumber] = await Promise.all([
        listSupabaseOrders(),
        readOrderWhatsappNumber().catch(() => ''),
      ]);
      return NextResponse.json({
        success: true,
        orders,
        whatsappNumber,
        primary: 'supabase',
        warning: null,
      });
    } catch (error) {
      const supabaseWarning = error instanceof Error ? error.message : 'Supabase orders could not be loaded.';
      try {
        const legacy = await readLegacyFirebaseOrders();
        const whatsappNumber = await readOrderWhatsappNumber().catch(() => '');
        return NextResponse.json({
          success: true,
          orders: legacy.orders,
          whatsappNumber,
          primary: 'firebase-fallback',
          warning: `Supabase orders could not be loaded. Showing Firebase fallback. ${supabaseWarning}`,
        });
      } catch (legacyError) {
        const legacyMessage = legacyError instanceof Error ? legacyError.message : String(legacyError);
        return NextResponse.json(
          { error: `Orders could not be loaded from Supabase or the Firebase fallback. ${supabaseWarning} ${legacyMessage}` },
          { status: 503 },
        );
      }
    }
  }

  try {
    const legacy = await readLegacyFirebaseOrders();
    const whatsappNumber = await readOrderWhatsappNumber().catch(() => '');
    return NextResponse.json({
      success: true,
      orders: legacy.orders,
      whatsappNumber,
      primary: 'firebase',
      warning: 'Supabase order storage is not configured on this deployment.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Orders could not be loaded.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = String(body?.action || '');

    if (action === 'save-whatsapp') {
      const number = String(body?.whatsappNumber || '').trim();
      const digits = number.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) {
        return NextResponse.json({ error: 'A valid WhatsApp number is required.' }, { status: 400 });
      }

      const mirrorWarning = await saveOrderWhatsappNumber(number);
      return NextResponse.json({
        success: true,
        primary: isSupabaseWriteConfigured() ? 'supabase' : 'firebase',
        whatsappNumber: number,
        mirrorWarning,
      });
    }

    if (action === 'sync-legacy') {
      if (!isSupabaseWriteConfigured()) {
        return NextResponse.json({ error: 'Supabase order storage is not configured.' }, { status: 503 });
      }

      try {
        const [supabaseOrders, legacy] = await Promise.all([
          listSupabaseOrders(),
          readLegacyFirebaseOrders(),
        ]);
        const copied = await backfillLegacyOrdersToSupabase(
          legacy.orders,
          new Set(supabaseOrders.map((order) => String(order.id))),
        );
        return NextResponse.json({
          success: true,
          primary: 'supabase',
          copied,
          totalLegacyOrders: legacy.orders.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const quotaExceeded = /RESOURCE_EXHAUSTED|quota exceeded/i.test(message);
        return NextResponse.json(
          {
            error: quotaExceeded
              ? 'Firebase legacy order sync is temporarily unavailable because its quota is exhausted.'
              : message || 'Legacy order sync failed.',
          },
          { status: 503 },
        );
      }
    }

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
