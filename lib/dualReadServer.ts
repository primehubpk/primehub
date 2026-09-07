import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';

type ReadMode = 'firebase-primary' | 'supabase-primary' | 'firebase-only' | 'supabase-only';

type CatalogSnapshot = { products: any[]; categories: any[]; source: 'firebase' | 'supabase' | 'empty' };
type SettingsSnapshot = { documents: Record<string, any>; source: 'firebase' | 'supabase' | 'empty' };
type SkillsSnapshot = { skills: any[]; source: 'firebase' | 'supabase' | 'empty' };

function mode(): ReadMode {
  const value = String(
    process.env.PRIMEHUB_DATA_READ_MODE ||
    process.env.PRIMEHUB_BACKEND_READ_MODE ||
    'firebase-primary'
  ).trim().toLowerCase();
  if (value === 'supabase-primary' || value === 'firebase-only' || value === 'supabase-only') return value;
  return 'firebase-primary';
}

function serial(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(serial);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try { return value.toDate().toISOString(); } catch { return null; }
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serial(item)]));
  }
  return value;
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) throw new Error('Supabase public read credentials are not configured.');
  return { url, key };
}

async function sbRows(table: string, select = '*') {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase ${table} read failed ${response.status}`);
  return await response.json() as any[];
}

function productFromSupabase(row: any) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...payload,
    id: row.id,
    title: payload.title ?? row.title ?? payload.name ?? row.name,
    name: payload.name ?? row.name ?? row.title,
    description: payload.description ?? row.description,
    categoryId: payload.categoryId ?? row.category_id,
    category: payload.category ?? row.category,
    price: payload.price ?? row.price,
    originalPrice: payload.originalPrice ?? row.original_price,
    stock: payload.stock ?? payload.quantity ?? row.stock,
    active: payload.active ?? row.active,
    imageUrl: payload.imageUrl ?? payload.image ?? row.image_url,
    images: Array.isArray(payload.images) ? payload.images : (Array.isArray(row.images) ? row.images : []),
    variants: Array.isArray(payload.variants) ? payload.variants : (Array.isArray(row.variants) ? row.variants : []),
    variantMatrix: Array.isArray(payload.variantMatrix) ? payload.variantMatrix : (Array.isArray(row.variant_matrix) ? row.variant_matrix : []),
  };
}

function categoryFromSupabase(row: any) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...payload,
    id: row.id,
    name: payload.name ?? row.name,
    slug: payload.slug ?? row.slug,
    imageUrl: payload.imageUrl ?? payload.iconUrl ?? row.image_url ?? row.icon_url,
    iconUrl: payload.iconUrl ?? payload.imageUrl ?? row.icon_url ?? row.image_url,
    active: payload.active ?? row.active,
    sortOrder: payload.sortOrder ?? payload.order ?? row.sort_order,
  };
}

function skillFromSupabase(row: any) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...payload,
    id: row.id,
    title: payload.title ?? payload.name ?? row.title,
    description: payload.description ?? row.description,
    price: payload.price ?? row.price,
    imageUrl: payload.imageUrl ?? payload.image ?? row.image_url,
    active: payload.active ?? row.active,
  };
}

async function firebaseCatalog(): Promise<CatalogSnapshot> {
  const db = getAdminDb();
  const [productsSnap, categoriesSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('categories').get(),
  ]);
  return {
    products: productsSnap.docs.map((doc) => ({ id: doc.id, ...serial(doc.data()) })),
    categories: categoriesSnap.docs.map((doc) => ({ id: doc.id, ...serial(doc.data()) })),
    source: 'firebase',
  };
}

async function supabaseCatalog(): Promise<CatalogSnapshot> {
  const [products, categories] = await Promise.all([
    sbRows('products'),
    sbRows('categories'),
  ]);
  return {
    products: products.map(productFromSupabase),
    categories: categories.map(categoryFromSupabase),
    source: 'supabase',
  };
}

async function firebaseSettings(): Promise<SettingsSnapshot> {
  const db = getAdminDb();
  const ids = ['main', 'general', 'policy', 'contact', 'reseller'];
  const snaps = await Promise.all(ids.map((id) => db.collection('settings').doc(id).get()));
  const documents: Record<string, any> = {};
  ids.forEach((id, index) => { if (snaps[index].exists) documents[id] = serial(snaps[index].data()); });
  return { documents, source: 'firebase' };
}

async function supabaseSettings(): Promise<SettingsSnapshot> {
  const rows = await sbRows('settings');
  const documents: Record<string, any> = {};
  for (const row of rows) documents[String(row.id)] = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  return { documents, source: 'supabase' };
}

async function firebaseSkills(): Promise<SkillsSnapshot> {
  const snap = await getAdminDb().collection('prime_skills').get();
  return { skills: snap.docs.map((doc) => ({ id: doc.id, ...serial(doc.data()) })), source: 'firebase' };
}

async function supabaseSkills(): Promise<SkillsSnapshot> {
  const rows = await sbRows('prime_skills');
  return { skills: rows.map(skillFromSupabase), source: 'supabase' };
}

async function withFallback<T>(firebaseRead: () => Promise<T>, supabaseRead: () => Promise<T>, empty: T): Promise<T> {
  const readMode = mode();
  const attempts = readMode === 'supabase-primary'
    ? [supabaseRead, firebaseRead]
    : readMode === 'firebase-primary'
      ? [firebaseRead, supabaseRead]
      : readMode === 'supabase-only'
        ? [supabaseRead]
        : [firebaseRead];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try { return await attempt(); }
    catch (error) {
      lastError = error;
      console.warn('PrimeHub dual-read attempt failed', error);
    }
  }
  if (lastError) console.error('PrimeHub dual-read exhausted all configured sources', lastError);
  return empty;
}

export function getDualCatalog() {
  return withFallback(firebaseCatalog, supabaseCatalog, { products: [], categories: [], source: 'empty' as const });
}

export function getDualSettings() {
  return withFallback(firebaseSettings, supabaseSettings, { documents: {}, source: 'empty' as const });
}

export function getDualSkills() {
  return withFallback(firebaseSkills, supabaseSkills, { skills: [], source: 'empty' as const });
}

export function getConfiguredReadMode() {
  return mode();
}
