import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { authorizedWalletAdmin } from '@/lib/walletAdminSession';
import { refundShoppingWalletOrder } from '@/lib/resellerShoppingCheckout';
import { creditDeliveredOrderBenefits } from '@/lib/deliveredOrderBenefits';
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
  return authorizedWalletAdmin(request);
}

function supabaseConfig() {
  return {
    url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
  };
}

async function listWhatsAppDrafts() {
  // Query newest requests without requiring a new composite Firestore index.
  const snap = await getAdminDb().collection('whatsapp_order_intents')
    .orderBy('createdAt', 'desc').limit(150).get();
  return snap.docs.filter(doc => doc.data()?.status === 'awaiting_confirmation')
    .slice(0, 100).map(doc => ({ id: doc.id, ...doc.data(), whatsappDraft: true }));
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
    const value = rows?.[0]?.payload?.whatsappNumber;
    return typeof value === 'string' ? value.trim() : '';
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

async function walletOrdersNotYetMirrored(known: Array<Record<string, any>>) {
  try {
    const snap = await getAdminDb().collection('orders').where('paymentMethod', 'in', ['shopping_wallet', 'shopping_wallet_plus_cod']).limit(100).get();
    const ids = new Set(known.map(order => String(order.id)));
    return snap.docs.filter(doc => !ids.has(doc.id)).map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  } catch (error) {
    console.error('Wallet order backup read unavailable:', error);
    return [] as Array<Record<string, any>>;
  }
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
  // Drafts are read only when admin opens Orders; no homepage polling.
  const whatsappDrafts = await listWhatsAppDrafts().catch(error => {
    console.warn('WhatsApp drafts temporarily unavailable:', error);
    return [];
  });
  if (isSupabaseWriteConfigured()) {
    try {
      const [orders, whatsappNumber] = await Promise.all([
        listSupabaseOrders(),
        readOrderWhatsappNumber().catch(() => ''),
      ]);
      const walletBackup = await walletOrdersNotYetMirrored(orders);
      return NextResponse.json({
        success: true,
        orders: [...walletBackup, ...orders],
        whatsappDrafts,
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
          whatsappDrafts,
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
      whatsappDrafts,
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
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Origin mismatch.' }, { status: 403 });
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

    if (action === 'record-whatsapp') {
      // For chats started directly in WhatsApp, which wa.me cannot report to us.
      // Admin enters what was actually agreed in the conversation.
      const customer = body?.customer || {};
      const name = String(customer.name || '').trim().slice(0, 120);
      const phone = String(customer.phone || '').trim().slice(0, 40);
      const city = String(customer.city || '').trim().slice(0, 120);
      const address = String(customer.address || '').trim().slice(0, 500);
      const selfCollect = body?.selfCollect === true;
      if (!name || phone.replace(/\D/g, '').length < 9 || (!selfCollect && (!city || !address))) {
        return NextResponse.json({ error: 'Customer name, valid phone, city and address are required.' }, { status: 400 });
      }
      const raw = Array.isArray(body?.items) ? body.items : [];
      if (!raw.length || raw.length > 30) return NextResponse.json({ error: 'Add 1 to 30 real products.' }, { status: 400 });
      const items: Array<Record<string, unknown>> = [];
      let subtotal = 0, totalItems = 0;
      for (const item of raw) {
        const title = String(item?.title || '').trim().slice(0, 150);
        const qty = Number(item?.quantity);
        const price = Number(item?.price);
        if (!title || !Number.isSafeInteger(qty) || qty < 1 || qty > 100 ||
          !Number.isSafeInteger(price) || price <= 0 || price > 1_000_000 ||
          !Number.isSafeInteger(subtotal + qty * price)) {
          return NextResponse.json({ error: 'Enter valid product names, quantities and prices.' }, { status: 400 });
        }
        subtotal += price * qty; totalItems += qty;
        const image = String(item?.image || '').trim();
        items.push({
          title, quantity: qty, price, image: /^https:\/\//.test(image) ? image.slice(0, 1500) : '',
          variant: { color: String(item?.color || '').slice(0, 60), size: String(item?.size || '').slice(0, 40) },
        });
      }
      const charge = selfCollect ? 0 : Number(body?.deliveryCharge);
      if (!Number.isSafeInteger(charge) || charge < 0 || charge > 10000) {
        return NextResponse.json({ error: 'Invalid delivery charge.' }, { status: 400 });
      }
      const id = crypto.randomUUID();
      const order = {
        id, customer: { name, phone, city: selfCollect ? 'Lahore' : city,
          address: selfCollect ? 'PrimeHub Shop Pickup' : address,
          notes: String(customer.notes || '').slice(0, 1000) },
        items, totalItems, subtotal, rawSubtotal: subtotal, deliveryCharge: charge,
        baseDelivery: charge, total: subtotal + charge, amountDue: subtotal + charge,
        currency: 'PKR', status: 'pending', source: 'whatsapp_manual',
        whatsappState: 'manually_recorded', adminVerified: true, selfCollect,
        fulfillment: selfCollect ? 'self_collect' : 'delivery',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      const db = getAdminDb();
      if (isSupabaseWriteConfigured()) {
        await supabasePrimaryUpsert({ table: 'orders',
          row: { ...mapOrderToSupabase(id, order), authoritative_source: 'supabase', mirror_status: 'synced', mirror_error: null } });
        try { await db.collection('orders').doc(id).set(order); }
        catch (error) { console.warn('Manual WhatsApp order Firebase mirror deferred:', error); }
      } else await db.collection('orders').doc(id).set(order);
      return NextResponse.json({ success: true, orderId: id });
    }

    if (action === 'confirm-whatsapp' || action === 'dismiss-whatsapp') {
      const id = String(body?.intentId || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid WhatsApp reference.' }, { status: 400 });
      const db = getAdminDb();
      const ref = db.collection('whatsapp_order_intents').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: 'WhatsApp request not found.' }, { status: 404 });
      const intent = snap.data() || {};
      if (intent.status !== 'awaiting_confirmation') return NextResponse.json({ error: 'WhatsApp request already reviewed.' }, { status: 409 });
      if (action === 'dismiss-whatsapp') {
        await ref.update({ status: 'dismissed', reviewedAt: new Date().toISOString() });
        return NextResponse.json({ success: true, status: 'dismissed' });
      }
      // This admin action requires checking the real incoming WhatsApp message.
      // Opening a wa.me link alone never counts an order or a reseller reward.
      const order = {
        ...intent, id, status: 'pending', isRealOrder: true,
        whatsappState: 'admin_confirmed', source: 'whatsapp',
        paymentMethod: 'cod', amountDue: Number(intent.total || 0),
        walletShoppingApplied: 0, confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      delete (order as any).whatsappDraft;
      if (isSupabaseWriteConfigured()) {
        await supabasePrimaryUpsert({ table: 'orders',
          row: { ...mapOrderToSupabase(id, order), authoritative_source: 'supabase', mirror_status: 'synced', mirror_error: null } });
        try { await db.collection('orders').doc(id).set(order, { merge: true }); }
        catch (error) { console.warn('WhatsApp confirmed order Firebase mirror delayed:', error); }
      } else {
        await db.collection('orders').doc(id).set(order, { merge: true });
      }
      await ref.update({ status: 'confirmed', confirmedAt: order.confirmedAt, confirmedOrderId: id });
      return NextResponse.json({ success: true, orderId: id, status: 'confirmed' });
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

      if (status === 'cancelled') {
        const spend = await db.collection('reseller_wallet_spends').doc(orderId).get();
        if (spend.exists) {
          if (!authorizedWalletAdmin(request)) return NextResponse.json({ error: 'Wallet admin login required to refund shopping credit.' }, { status: 401 });
          const refunded = await refundShoppingWalletOrder(orderId);
          if (isSupabaseWriteConfigured()) {
            const row = { ...mapOrderToSupabase(orderId, refunded.order), authoritative_source: 'firebase' };
            try { await supabasePrimaryUpsert({ table: 'orders', row }); }
            catch (error) { console.error('Wallet cancellation order mirror deferred:', error); try { await recordMirrorFailure('orders', orderId, 'upsert', row); } catch {} }
          }
          legacyOrdersCache = legacyOrdersCache.map(order => order.id === orderId ? { ...order, status: 'cancelled', walletPaymentStatus: 'refunded' } : order);
          return NextResponse.json({ success: true, primary: 'firebase-wallet', walletRefunded: refunded.applied });
        }
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

        if (['cancelled', 'refunded'].includes(String(existing.status || '')) && status === 'delivered') {
          return NextResponse.json({ error: 'Cancelled orders cannot be delivered or rewarded.' }, { status: 409 });
        }
        if (String(existing.status || '') === 'delivered' && status !== 'delivered' &&
            existing.resellerRewardStatus === 'credited') {
          return NextResponse.json({ error: 'Credited delivered orders require manual financial review before changing their status.' }, { status: 409 });
        }
        let credited: Awaited<ReturnType<typeof creditDeliveredOrderBenefits>> | null = null;
        if (status === 'delivered' && existing.resellerUserId &&
            existing.cashbackPolicy === 'delivered_only_v1') {
          credited = await creditDeliveredOrderBenefits(orderId, existing);
        }
        const nextOrder = { ...existing, status, updatedAt: new Date().toISOString(),
          ...(credited ? { resellerRewardStatus: 'credited', resellerReward: credited.reward,
            resellerCashback: credited.cashback, voucherCashCredited: credited.voucherCash } : {}) };
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
        return NextResponse.json({ success: true, primary: 'supabase', ...(credited ? { cashback: credited.cashback, voucherCash: credited.voucherCash, alreadyCredited: credited.alreadyCredited } : {}) });
      }

      const snapshot = await orderRef.get();
      if (!snapshot.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      const existingOrder = snapshot.data() || {};
      if (status === 'delivered' && ['cancelled', 'refunded'].includes(String(existingOrder.status || ''))) {
        return NextResponse.json({ error: 'Cancelled orders cannot be delivered.' }, { status: 409 });
      }
      if (existingOrder.status === 'delivered' && existingOrder.resellerRewardStatus === 'credited' && status !== 'delivered') {
        return NextResponse.json({ error: 'Credited orders require a manual financial review.' }, { status: 409 });
      }
      let credited: Awaited<ReturnType<typeof creditDeliveredOrderBenefits>> | null = null;
      if (status === 'delivered' && existingOrder.resellerUserId && existingOrder.cashbackPolicy === 'delivered_only_v1') {
        credited = await creditDeliveredOrderBenefits(orderId, existingOrder);
      }
      await orderRef.update({ status, updatedAt: new Date(),
        ...(credited ? { resellerRewardStatus: 'credited', resellerReward: credited.reward,
          resellerCashback: credited.cashback, voucherCashCredited: credited.voucherCash } : {}) });
      legacyOrdersCache = legacyOrdersCache.map((order) => order.id === orderId ? { ...order, status } : order);
      return NextResponse.json({ success: true, primary: 'firebase',
        ...(credited ? { cashback: credited.cashback, voucherCash: credited.voucherCash, alreadyCredited: credited.alreadyCredited } : {}) });
    }

    if (action === 'delete') {
      const walletSpend = await db.collection('reseller_wallet_spends').doc(orderId).get();
      if (walletSpend.exists) {
        if (!authorizedWalletAdmin(request)) return NextResponse.json({ error: 'Wallet admin login required.' }, { status: 401 });
        if (walletSpend.data()?.status !== 'refunded') return NextResponse.json({ error: 'Cancel and refund shopping credit before deleting a wallet order.' }, { status: 409 });
      }
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
