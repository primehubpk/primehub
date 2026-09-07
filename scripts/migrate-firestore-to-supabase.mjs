#!/usr/bin/env node

/**
 * PrimeHub Phase 3: one-way initial copy from Firebase Firestore -> Supabase.
 *
 * Safety rules:
 * - preserves Firebase document IDs
 * - does NOT delete or modify Firebase data
 * - uses upsert in Supabase so reruns are idempotent
 * - stores the original Firestore document in `payload`
 * - marks imported rows authoritative_source='firebase' and mirror_status='synced'
 * - aborts on collection read/write errors; never reports partial success as full success
 *
 * Required env:
 *   FIREBASE_SERVICE_ACCOUNT_KEY=<service account JSON>
 *   SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
 * Optional env:
 *   PHASE3_DRY_RUN=true
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = String(process.env.PHASE3_DRY_RUN || '').toLowerCase() === 'true';
const BATCH_SIZE = 200;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const supabaseUrl = required('SUPABASE_URL').replace(/\/+$/, '');
const supabaseKey = required('SUPABASE_SERVICE_ROLE_KEY');
const firebaseServiceAccount = JSON.parse(required('FIREBASE_SERVICE_ACCOUNT_KEY'));

if (!getApps().length) initializeApp({ credential: cert(firebaseServiceAccount) });
const db = getFirestore();

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function bool(v, fallback = true) {
  return typeof v === 'boolean' ? v : fallback;
}

function iso(v) {
  if (!v) return null;
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function jsonSafe(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.latitude === 'number' && typeof value?.longitude === 'number') {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

function common(data) {
  return {
    payload: jsonSafe(data || {}),
    authoritative_source: 'firebase',
    mirror_status: 'synced',
    mirror_error: null,
    created_at: iso(data?.createdAt) || new Date().toISOString(),
    updated_at: iso(data?.updatedAt) || iso(data?.createdAt) || new Date().toISOString(),
    sync_version: 1,
  };
}

const mappings = {
  products: (id, d) => ({
    id,
    title: d.title ?? null,
    name: d.name ?? null,
    description: d.description ?? null,
    category_id: d.categoryId ?? null,
    category: d.category ?? null,
    price: num(d.price),
    original_price: num(d.originalPrice),
    stock: num(d.stock ?? d.quantity),
    active: bool(d.active, true),
    image_url: d.imageUrl ?? d.image ?? null,
    images: jsonSafe(Array.isArray(d.images) ? d.images : []),
    variants: jsonSafe(Array.isArray(d.variants) ? d.variants : []),
    variant_matrix: jsonSafe(Array.isArray(d.variantMatrix) ? d.variantMatrix : []),
    firebase_updated_at: iso(d.updatedAt),
    ...common(d),
  }),
  categories: (id, d) => ({
    id,
    name: d.name ?? null,
    slug: d.slug ?? null,
    image_url: d.imageUrl ?? d.iconUrl ?? null,
    icon_url: d.iconUrl ?? d.imageUrl ?? null,
    active: bool(d.active, true),
    sort_order: int(d.sortOrder ?? d.order, 0),
    ...common(d),
  }),
  settings: (id, d) => ({ id, ...common(d) }),
  prime_skills: (id, d) => ({
    id,
    title: d.title ?? d.name ?? null,
    description: d.description ?? null,
    price: num(d.price),
    image_url: d.imageUrl ?? d.image ?? null,
    active: bool(d.active, true),
    ...common(d),
  }),
  orders: (id, d) => ({
    id,
    idempotency_key: d.idempotencyKey ?? `firebase-order:${id}`,
    customer: jsonSafe(d.customer || {}),
    items: jsonSafe(Array.isArray(d.items) ? d.items : []),
    raw_subtotal: num(d.rawSubtotal),
    subtotal: num(d.subtotal),
    delivery_charge: num(d.deliveryCharge),
    total: num(d.total),
    currency: d.currency || 'PKR',
    status: d.status || 'pending',
    source: d.source ?? null,
    fulfillment: d.fulfillment ?? null,
    reseller_user_id: d.resellerUserId ?? null,
    firebase_mirrored_at: new Date().toISOString(),
    ...common(d),
  }),
  reviews: (id, d) => ({
    id,
    product_id: String(d.productId || ''),
    order_id: String(d.orderId || ''),
    name: d.name ?? null,
    rating: int(d.rating, 0) || null,
    comment: d.comment ?? null,
    image_url: d.imageUrl ?? null,
    photos: jsonSafe(Array.isArray(d.photos) ? d.photos : []),
    verified: d.verified === true,
    source: d.source ?? null,
    ...common(d),
  }),
  reward_gifts: (id, d) => ({ id, active: bool(d.active, true), ...common(d) }),
  user_rewards: (id, d) => ({ id, user_id: d.userId ?? id ?? null, ...common(d) }),
  reward_redemptions: (id, d) => ({
    id,
    idempotency_key: d.idempotencyKey ?? `firebase-redemption:${id}`,
    user_id: d.userId ?? null,
    status: d.status ?? null,
    ...common(d),
  }),
  reseller_profiles: (id, d) => ({
    user_id: id,
    email: d.email ?? null,
    status: d.status ?? null,
    tier_id: d.tierId ?? null,
    monthly_orders: int(d.monthlyOrders, 0),
    wallet_available: num(d.walletAvailable) ?? 0,
    wallet_pending: num(d.walletPending) ?? 0,
    points_balance: int(d.pointsBalance, 0),
    ...common(d),
  }),
  reseller_withdrawals: (id, d) => ({
    id,
    idempotency_key: d.idempotencyKey ?? `firebase-withdrawal:${id}`,
    user_id: String(d.userId || ''),
    amount: num(d.amount) ?? 0,
    method: d.method ?? null,
    status: d.status ?? null,
    ...common(d),
  }),
  reseller_reward_ledger: (id, d) => ({
    id,
    user_id: String(d.userId || ''),
    order_id: d.orderId ?? id ?? null,
    reward_amount: num(d.rewardAmount) ?? 0,
    status: d.status ?? null,
    available_at: iso(d.availableAt),
    ...common(d),
  }),
  reseller_task_claims: (id, d) => ({
    id,
    user_id: String(d.userId || ''),
    task_id: String(d.taskId || ''),
    proof: d.proof ?? null,
    status: d.status ?? null,
    points: int(d.points, 0) || null,
    ...common(d),
  }),
  reseller_point_ledger: (id, d) => ({
    id,
    user_id: String(d.userId || ''),
    claim_id: d.claimId ?? null,
    task_id: d.taskId ?? null,
    points: int(d.points, 0),
    reason: d.reason ?? null,
    status: d.status ?? null,
    ...common(d),
  }),
  reseller_task_events: (id, d) => ({
    id,
    user_id: String(d.userId || ''),
    task_id: d.taskId ?? null,
    event: d.event ?? null,
    ...common(d),
  }),
  reseller_whatsapp_orders: (id, d) => ({
    id,
    idempotency_key: d.idempotencyKey ?? `firebase-wa-order:${id}`,
    reseller_user_id: String(d.resellerUserId || ''),
    reseller_code: d.resellerCode ?? null,
    customer: jsonSafe(d.customer || {}),
    items: jsonSafe(Array.isArray(d.items) ? d.items : []),
    subtotal: num(d.subtotal),
    delivery_charge: num(d.deliveryCharge),
    total: num(d.total),
    status: d.status ?? null,
    ...common(d),
  }),
  salaar_conversations: (id, d) => ({
    session_id: id,
    status: d.status || 'AUTO',
    hold_type: d.holdType ?? null,
    soft_hold_until: iso(d.softHoldUntil),
    need_you: d.needYou === true,
    order_stage: d.orderStage ?? null,
    advance_required: num(d.advanceRequired),
    cart_summary: jsonSafe(d.cartSummary ?? null),
    pending_customer_message: d.pendingCustomerMessage ?? null,
    pending_shown_product_ids: jsonSafe(Array.isArray(d.pendingShownProductIds) ? d.pendingShownProductIds : []),
    pending_message_doc_id: d.pendingMessageDocId ?? null,
    last_message: d.lastMessage ?? null,
    last_role: d.lastRole ?? null,
    ...common(d),
  }),
};

const collections = [
  'products', 'categories', 'settings', 'prime_skills', 'orders', 'reviews',
  'reward_gifts', 'user_rewards', 'reward_redemptions', 'reseller_profiles',
  'reseller_withdrawals', 'reseller_reward_ledger', 'reseller_task_claims',
  'reseller_point_ledger', 'reseller_task_events', 'reseller_whatsapp_orders',
  'salaar_conversations',
];

async function supabaseUpsert(table, rows, conflictColumn) {
  if (!rows.length || DRY_RUN) return;
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set('on_conflict', conflictColumn);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Supabase ${table} upsert failed ${response.status}: ${await response.text()}`);
}

async function supabaseCount(table) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!response.ok) throw new Error(`Supabase ${table} count failed ${response.status}`);
  const range = response.headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

async function migrateCollection(name) {
  const mapper = mappings[name];
  if (!mapper) throw new Error(`Missing mapper for ${name}`);
  const snap = await db.collection(name).get();
  const rows = snap.docs.map((doc) => mapper(doc.id, doc.data()));
  const conflict = name === 'reseller_profiles' ? 'user_id' : name === 'salaar_conversations' ? 'session_id' : 'id';
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await supabaseUpsert(name, rows.slice(i, i + BATCH_SIZE), conflict);
  }
  return { firebase: rows.length, supabase: DRY_RUN ? null : await supabaseCount(name) };
}

async function migrateSalaarMessages() {
  let firebaseCount = 0;
  const rows = [];
  const conversations = await db.collection('salaar_conversations').get();
  for (const convo of conversations.docs) {
    const messages = await convo.ref.collection('messages').get();
    for (const message of messages.docs) {
      const d = message.data() || {};
      rows.push({
        id: message.id,
        session_id: convo.id,
        role: d.role === 'customer' ? 'customer' : 'salaar',
        text: d.text ?? null,
        pending: d.pending === true,
        ...common(d),
      });
      firebaseCount++;
      if (rows.length >= BATCH_SIZE) {
        await supabaseUpsert('salaar_messages', rows.splice(0, rows.length), 'id');
      }
    }
  }
  if (rows.length) await supabaseUpsert('salaar_messages', rows, 'id');
  return { firebase: firebaseCount, supabase: DRY_RUN ? null : await supabaseCount('salaar_messages') };
}

async function writeMigrationState(report) {
  if (DRY_RUN) return;
  const row = {
    key: 'phase3_initial_firestore_copy',
    value: {
      completedAt: new Date().toISOString(),
      source: 'firebase',
      target: 'supabase',
      dryRun: false,
      report,
    },
  };
  await supabaseUpsert('migration_state', [row], 'key');
}

async function main() {
  console.log(`Phase 3 Firestore -> Supabase initial copy${DRY_RUN ? ' (DRY RUN)' : ''}`);
  const report = {};
  for (const name of collections) {
    process.stdout.write(`- ${name}: `);
    report[name] = await migrateCollection(name);
    console.log(`${report[name].firebase} Firebase docs -> ${DRY_RUN ? 'dry-run' : `${report[name].supabase} Supabase rows`}`);
  }
  process.stdout.write('- salaar_messages: ');
  report.salaar_messages = await migrateSalaarMessages();
  console.log(`${report.salaar_messages.firebase} Firebase docs -> ${DRY_RUN ? 'dry-run' : `${report.salaar_messages.supabase} Supabase rows`}`);

  const mismatches = Object.entries(report).filter(([, v]) => !DRY_RUN && v.supabase < v.firebase);
  if (mismatches.length) {
    throw new Error(`Phase 3 verification failed: ${mismatches.map(([k, v]) => `${k} ${v.firebase}>${v.supabase}`).join(', ')}`);
  }

  await writeMigrationState(report);
  console.log('Phase 3 copy and minimum count verification completed successfully.');
  console.log('Firebase was not modified. Website cutover is NOT performed by this script.');
}

main().catch((error) => {
  console.error('PHASE 3 FAILED:', error);
  process.exitCode = 1;
});
