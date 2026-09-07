#!/usr/bin/env node

/**
 * Phase 3 public-catalog fallback.
 * Reads only customer-visible Firestore collections through the same public
 * Data API surface used by browser clients, then upserts them into Supabase.
 *
 * Safety:
 * - does not modify Firebase
 * - does not change website runtime/read mode
 * - preserves Firestore document IDs
 * - rerunnable/idempotent Supabase upserts
 */

const PROJECT_ID = 'prime-hub-a02f0';
const FIREBASE_WEB_API_KEY = 'AIzaSyA0jI5esNvMt3Sb3WVy7NQShsoWzntJxQU';
const BATCH_SIZE = 200;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const supabaseUrl = required('SUPABASE_URL').replace(/\/+$/, '');
const supabaseKey = required('SUPABASE_SERVICE_ROLE_KEY');

function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return v.bytesValue;
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) out[key] = decodeValue(value);
  return out;
}

function docId(name) {
  return String(name || '').split('/').pop();
}

async function fetchPublicCollection(collection) {
  const docs = [];
  let pageToken = '';
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`);
    url.searchParams.set('pageSize', '300');
    url.searchParams.set('key', FIREBASE_WEB_API_KEY);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await response.text();
    if (!response.ok) throw new Error(`Public Firestore ${collection} read failed ${response.status}: ${text.slice(0, 800)}`);
    const body = text ? JSON.parse(text) : {};
    for (const doc of body.documents || []) {
      docs.push({ id: docId(doc.name), data: decodeFields(doc.fields || {}) });
    }
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return docs;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v, fallback = true) {
  return typeof v === 'boolean' ? v : fallback;
}

function common(data) {
  return {
    payload: data || {},
    authoritative_source: 'firebase',
    mirror_status: 'synced',
    mirror_error: null,
    sync_version: 1,
    created_at: data?.createdAt || new Date().toISOString(),
    updated_at: data?.updatedAt || data?.createdAt || new Date().toISOString(),
  };
}

function mapProduct(id, d) {
  return {
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
    images: Array.isArray(d.images) ? d.images : [],
    variants: Array.isArray(d.variants) ? d.variants : [],
    variant_matrix: Array.isArray(d.variantMatrix) ? d.variantMatrix : [],
    firebase_updated_at: d.updatedAt ?? null,
    ...common(d),
  };
}

function mapCategory(id, d) {
  return {
    id,
    name: d.name ?? d.title ?? null,
    slug: d.slug ?? null,
    image_url: d.imageUrl ?? d.iconUrl ?? d.image ?? null,
    icon_url: d.iconUrl ?? d.imageUrl ?? d.image ?? null,
    active: bool(d.active, true),
    sort_order: Number.isFinite(Number(d.sortOrder ?? d.order)) ? Math.trunc(Number(d.sortOrder ?? d.order)) : 0,
    ...common(d),
  };
}

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows.slice(i, i + BATCH_SIZE)),
    });
    if (!response.ok) throw new Error(`Supabase ${table} upsert failed ${response.status}: ${await response.text()}`);
  }
}

async function count(table) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id`, {
    method: 'HEAD',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!response.ok) throw new Error(`Supabase ${table} count failed ${response.status}`);
  const total = Number((response.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

async function main() {
  console.log('Phase 3 public catalog fallback: Firestore REST -> Supabase');
  const [productsSource, categoriesSource] = await Promise.all([
    fetchPublicCollection('products'),
    fetchPublicCollection('categories'),
  ]);

  console.log(`Public Firestore products: ${productsSource.length}`);
  console.log(`Public Firestore categories: ${categoriesSource.length}`);

  if (!productsSource.length) throw new Error('Public catalog returned zero products; refusing to seed an empty catalog.');

  const products = productsSource.map(({ id, data }) => mapProduct(id, data));
  const categories = categoriesSource.map(({ id, data }) => mapCategory(id, data));
  await upsert('products', products);
  await upsert('categories', categories);

  const [productsTarget, categoriesTarget] = await Promise.all([count('products'), count('categories')]);
  console.log(`Supabase products rows: ${productsTarget}`);
  console.log(`Supabase categories rows: ${categoriesTarget}`);

  if (productsTarget < products.length || categoriesTarget < categories.length) {
    throw new Error(`Catalog verification failed: source products=${products.length}, target=${productsTarget}; source categories=${categories.length}, target=${categoriesTarget}`);
  }

  console.log('PHASE3_PUBLIC_CATALOG_OK');
  console.log('Website runtime was not changed. Firebase was not modified.');
}

main().catch((error) => {
  console.error('PHASE3_PUBLIC_CATALOG_FAILED:', error);
  process.exitCode = 1;
});
