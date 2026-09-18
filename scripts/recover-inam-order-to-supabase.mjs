import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceAccount || !supabaseUrl || !supabaseKey) {
  throw new Error('Missing Firebase or Supabase recovery credentials.');
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
}

const db = getFirestore();

function iso(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

function jsonSafe(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, jsonSafe(nested)]));
  }
  return value;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function queryCandidates() {
  const candidates = new Map();
  const queries = [
    db.collection('orders').where('customer.phone', '==', '+92 336 9144628').limit(10),
    db.collection('orders').where('customer.phone', '==', '+923369144628').limit(10),
    db.collection('orders').where('customer.phone', '==', '03369144628').limit(10),
    db.collection('orders').where('customer.name', '==', 'Inam').limit(10),
  ];

  for (const query of queries) {
    try {
      const snapshot = await query.get();
      for (const doc of snapshot.docs) candidates.set(doc.id, doc);
    } catch (error) {
      console.warn('A targeted Firebase lookup failed:', error instanceof Error ? error.message : String(error));
    }
  }

  return [...candidates.values()];
}

async function supabaseRequest(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed ${response.status}: ${await response.text()}`);
  return response;
}

const candidates = await queryCandidates();
const target = candidates.find((doc) => doc.id.endsWith('C6fFSD'))
  || candidates.find((doc) => String(doc.data()?.customer?.name || '').trim().toLowerCase() === 'inam');

if (!target) {
  throw new Error('Inam order ending C6fFSD could not be read from Firebase yet.');
}

const id = target.id;
const data = target.data() || {};

const existingResponse = await supabaseRequest(`orders?select=id&id=eq.${encodeURIComponent(id)}&limit=1`, { method: 'GET' });
const existing = await existingResponse.json();
if (Array.isArray(existing) && existing.length) {
  console.log(`Inam order ${id.slice(-6)} already exists in Supabase; no write needed.`);
  process.exit(0);
}

const now = new Date().toISOString();
const createdAt = iso(data.createdAt) || now;
const updatedAt = iso(data.updatedAt) || createdAt;
const row = {
  id,
  idempotency_key: data.idempotencyKey || `order:${id}`,
  customer: jsonSafe(data.customer || {}),
  items: jsonSafe(Array.isArray(data.items) ? data.items : []),
  raw_subtotal: numberOrNull(data.rawSubtotal),
  subtotal: numberOrNull(data.subtotal),
  delivery_charge: numberOrNull(data.deliveryCharge),
  total: numberOrNull(data.total),
  currency: data.currency || 'PKR',
  status: data.status || 'pending',
  source: data.source ?? null,
  fulfillment: data.fulfillment ?? null,
  reseller_user_id: data.resellerUserId ?? null,
  payload: jsonSafe(data),
  authoritative_source: 'supabase',
  mirror_status: 'synced',
  mirror_error: null,
  firebase_mirrored_at: now,
  created_at: createdAt,
  updated_at: updatedAt,
  sync_version: Number(data.syncVersion || 1),
};

await supabaseRequest('orders?on_conflict=id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(row),
});

console.log(`Recovered Inam order ${id.slice(-6)} into Supabase.`);
