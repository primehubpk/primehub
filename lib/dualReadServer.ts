import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';

type ReadMode = 'firebase-primary' | 'supabase-primary' | 'firebase-only' | 'supabase-only';

type CatalogSnapshot = { products: any[]; categories: any[]; source: 'firebase' | 'supabase' | 'empty' };
type ProductSnapshot = { product: any | null; source: 'firebase' | 'supabase' | 'empty' };
type CategoriesSnapshot = { categories: any[]; source: 'firebase' | 'supabase' | 'empty' };
type SettingsSnapshot = { documents: Record<string, any>; source: 'firebase' | 'supabase' | 'empty' };
type SkillsSnapshot = { skills: any[]; source: 'firebase' | 'supabase' | 'empty' };

function envValue(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function mode(): ReadMode {
  const value = String(
    process.env.PRIMEHUB_DATA_READ_MODE ||
    process.env.PRIMEHUB_BACKEND_READ_MODE ||
    'supabase-primary'
  ).trim().toLowerCase();

  if (
    value === 'firebase-primary' ||
    value === 'supabase-primary' ||
    value === 'firebase-only' ||
    value === 'supabase-only'
  ) return value;

  // Supabase is the canonical read backend. A missing/typoed mode must never
  // silently switch the storefront back to Firebase.
  return 'supabase-primary';
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

function supabaseUrl() {
  return envValue(
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
  ).replace(/\/+$/, '');
}

function supabasePublicKey() {
  return envValue(
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
}

function supabaseServiceKey() {
  return envValue(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_KEY',
  );
}

function supabaseConfigError(kind: 'public' | 'server', url: string, key: string) {
  const environment = envValue('VERCEL_ENV', 'NODE_ENV') || 'unknown';
  const hasPublicKey = Boolean(supabasePublicKey());
  const hasServiceKey = Boolean(supabaseServiceKey());
  return new Error(
    `Supabase ${kind} read credentials are not configured ` +
    `(environment=${environment}, url=${Boolean(url)}, publicKey=${hasPublicKey}, serviceKey=${hasServiceKey}, selectedKey=${Boolean(key)}).`,
  );
}

function supabaseConfig() {
  const url = supabaseUrl();
  // This module is server-only. Prefer the public/publishable key for public
  // tables, but allow the server secret as a safe server-side fallback so a
  // correctly configured Supabase project does not fall through to Firebase
  // just because Vercel uses the newer secret-key variable naming.
  const key = supabasePublicKey() || supabaseServiceKey();
  if (!url || !key) throw supabaseConfigError('public', url, key);
  return { url, key };
}

function supabaseServiceConfig() {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) throw supabaseConfigError('server', url, key);
  return { url, key };
}

async function sbRows(table: string, select = '*', useServiceRole = false) {
  const { url, key } = useServiceRole ? supabaseServiceConfig() : supabaseConfig();
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

async function firebaseProduct(id: string): Promise<ProductSnapshot> {
  const snapshot = await getAdminDb().collection('products').doc(id).get();
  if (!snapshot.exists) throw new Error(`Firebase product ${id} was not found.`);
  return {
    product: { id: snapshot.id, ...serial(snapshot.data()) },
    source: 'firebase',
  };
}

async function supabaseProduct(id: string): Promise<ProductSnapshot> {
  const { url, key } = supabaseConfig();
  const response = await fetch(
    `${url}/rest/v1/products?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    },
  );
  if (!response.ok) throw new Error(`Supabase product read failed ${response.status}`);
  const rows = await response.json() as any[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Supabase product ${id} was not found.`);
  }
  return { product: productFromSupabase(rows[0]), source: 'supabase' };
}

async function firebaseCategories(): Promise<CategoriesSnapshot> {
  const snap = await getAdminDb().collection('categories').get();
  return {
    categories: snap.docs.map((doc) => ({ id: doc.id, ...serial(doc.data()) })),
    source: 'firebase',
  };
}

async function supabaseCategories(): Promise<CategoriesSnapshot> {
  const rows = await sbRows('categories');
  return { categories: rows.map(categoryFromSupabase), source: 'supabase' };
}

async function firebaseSettings(): Promise<SettingsSnapshot> {
  // Read the collection rather than a fixed document-id list. This is server-side
  // and lets future admin-created settings documents become available to safe
  // consumers (such as Salaar Store Knowledge) without another code deployment.
  const snap = await getAdminDb().collection('settings').get();
  const documents: Record<string, any> = {};
  for (const doc of snap.docs) documents[doc.id] = serial(doc.data());
  if (Object.keys(documents).length === 0) throw new Error('Firebase settings read returned no rows.');
  return { documents, source: 'firebase' };
}

async function supabaseSettings(): Promise<SettingsSnapshot> {
  // Settings intentionally have no public RLS policy. Read them only server-side
  // with the service-role/secret key so private configuration never has to be opened to anon.
  const rows = await sbRows('settings', '*', true);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Supabase settings read returned no rows.');
  }
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

export function getDualProduct(id: string) {
  const productId = String(id || '').trim();
  if (!productId) {
    return Promise.resolve({ product: null, source: 'empty' as const });
  }
  return withFallback(
    () => firebaseProduct(productId),
    () => supabaseProduct(productId),
    { product: null, source: 'empty' as const },
  );
}

export function getDualCategories() {
  return withFallback(firebaseCategories, supabaseCategories, { categories: [], source: 'empty' as const });
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
