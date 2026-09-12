import 'server-only';

export type DualWriteMode = 'firebase-primary' | 'supabase-primary';

type MirrorResult = { attempted: boolean; ok: boolean; error?: string };

type SupabaseRequest = {
  table: string;
  row?: Record<string, any>;
  id?: string;
  conflict?: string;
};

function cfg() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  return { url, key, configured: Boolean(url && key) };
}

export function getDualWriteMode(): DualWriteMode {
  return process.env.PRIMEHUB_BACKEND_WRITE_MODE === 'firebase-primary' ? 'firebase-primary' : 'supabase-primary';
}

export function isSupabaseWriteConfigured() {
  return cfg().configured;
}

async function supabaseFetch(path: string, init: RequestInit) {
  const { url, key, configured } = cfg();
  if (!configured) throw new Error('Supabase server write credentials are not configured.');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase write failed ${response.status}: ${await response.text()}`);
  return response;
}

export async function supabasePrimaryUpsert({ table, row, conflict = 'id' }: SupabaseRequest) {
  if (!row) throw new Error('Missing Supabase primary row.');
  const params = new URLSearchParams({ on_conflict: conflict });
  await supabaseFetch(`${table}?${params.toString()}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
}

export async function supabasePrimaryDelete({ table, id }: SupabaseRequest) {
  if (!id) throw new Error('Missing Supabase primary document id.');
  await supabaseFetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getSupabasePrimaryPayload(table: string, id: string): Promise<Record<string, any> | null> {
  if (!id) return null;
  const response = await supabaseFetch(
    `${table}?select=id,payload&id=eq.${encodeURIComponent(id)}&limit=1`,
    { method: 'GET' },
  );
  const rows = await response.json() as any[];
  const payload = rows?.[0]?.payload;
  return payload && typeof payload === 'object' ? payload as Record<string, any> : null;
}

export async function findSupabaseProductBySlug(slug: string): Promise<{ id: string; payload: Record<string, any> } | null> {
  const normalized = String(slug || '').trim();
  if (!normalized) return null;
  const params = new URLSearchParams();
  params.set('select', 'id,payload');
  params.set('payload->>slug', `eq.${normalized}`);
  params.set('limit', '1');
  const response = await supabaseFetch(`products?${params.toString()}`, { method: 'GET' });
  const rows = await response.json() as any[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return {
    id: String(rows[0].id),
    payload: rows[0]?.payload && typeof rows[0].payload === 'object' ? rows[0].payload : {},
  };
}

export async function mirrorSupabaseUpsert({ table, row, conflict = 'id' }: SupabaseRequest): Promise<MirrorResult> {
  if (!row) return { attempted: false, ok: false, error: 'Missing row.' };
  if (!isSupabaseWriteConfigured()) return { attempted: false, ok: true };
  try {
    await supabasePrimaryUpsert({ table, row, conflict });
    return { attempted: true, ok: true };
  } catch (error) {
    return { attempted: true, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function mirrorSupabaseDelete({ table, id }: SupabaseRequest): Promise<MirrorResult> {
  if (!id) return { attempted: false, ok: false, error: 'Missing id.' };
  if (!isSupabaseWriteConfigured()) return { attempted: false, ok: true };
  try {
    await supabasePrimaryDelete({ table, id });
    return { attempted: true, ok: true };
  } catch (error) {
    return { attempted: true, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function iso(value: any): string | null {
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

function jsonSafe(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  return value;
}

function n(value: any): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function common(data: Record<string, any>, authoritativeSource: 'firebase' | 'supabase') {
  return {
    payload: jsonSafe(data),
    authoritative_source: authoritativeSource,
    mirror_status: 'synced',
    mirror_error: null,
    created_at: iso(data.createdAt) || new Date().toISOString(),
    updated_at: iso(data.updatedAt) || iso(data.createdAt) || new Date().toISOString(),
    sync_version: Number(data.syncVersion || 1),
  };
}

export function mapDocumentToSupabase(
  collection: string,
  id: string,
  data: Record<string, any>,
  authoritativeSource: 'firebase' | 'supabase' = 'supabase',
) {
  switch (collection) {
    case 'products':
      return { id, title: data.title ?? null, name: data.name ?? null, description: data.description ?? null, category_id: data.categoryId ?? null, category: data.category ?? null, price: n(data.price), original_price: n(data.originalPrice), stock: n(data.stock ?? data.quantity), active: data.active !== false, image_url: data.imageUrl ?? data.image ?? null, images: jsonSafe(Array.isArray(data.images) ? data.images : []), variants: jsonSafe(Array.isArray(data.variants) ? data.variants : []), variant_matrix: jsonSafe(Array.isArray(data.variantMatrix) ? data.variantMatrix : []), firebase_updated_at: authoritativeSource === 'firebase' ? iso(data.updatedAt) : null, ...common(data, authoritativeSource) };
    case 'categories':
      return { id, name: data.name ?? data.title ?? null, slug: data.slug ?? null, image_url: data.imageUrl ?? data.iconUrl ?? null, icon_url: data.iconUrl ?? data.imageUrl ?? null, active: data.active !== false, sort_order: Number(data.sortOrder ?? data.order ?? 0), ...common(data, authoritativeSource) };
    case 'settings':
      return { id, ...common(data, authoritativeSource) };
    case 'prime_skills':
      return { id, title: data.title ?? data.name ?? null, description: data.description ?? null, price: n(data.price), image_url: data.imageUrl ?? data.image ?? null, active: data.active !== false, ...common(data, authoritativeSource) };
    case 'reward_gifts':
      return { id, active: data.active !== false, ...common(data, authoritativeSource) };
    default:
      return null;
  }
}

export function mapFirebaseDocumentToSupabase(collection: string, id: string, data: Record<string, any>) {
  return mapDocumentToSupabase(collection, id, data, 'firebase');
}

export function mapOrderToSupabase(id: string, data: Record<string, any>) {
  return {
    id,
    idempotency_key: data.idempotencyKey || `order:${id}`,
    customer: jsonSafe(data.customer || {}),
    items: jsonSafe(Array.isArray(data.items) ? data.items : []),
    raw_subtotal: n(data.rawSubtotal),
    subtotal: n(data.subtotal),
    delivery_charge: n(data.deliveryCharge),
    total: n(data.total),
    currency: data.currency || 'PKR',
    status: data.status || 'pending',
    source: data.source ?? null,
    fulfillment: data.fulfillment ?? null,
    reseller_user_id: data.resellerUserId ?? null,
    firebase_mirrored_at: new Date().toISOString(),
    ...common(data, 'firebase'),
  };
}

export function mapReviewToSupabase(id: string, data: Record<string, any>) {
  return {
    id,
    product_id: String(data.productId || ''),
    order_id: String(data.orderId || ''),
    name: data.name ?? null,
    rating: n(data.rating),
    comment: data.comment ?? null,
    image_url: data.imageUrl ?? null,
    photos: jsonSafe(Array.isArray(data.photos) ? data.photos : []),
    verified: data.verified === true,
    source: data.source ?? null,
    ...common(data, 'firebase'),
  };
}

export async function recordMirrorFailure(entityType: string, entityId: string, operation: string, payload: Record<string, any>, target = 'supabase') {
  if (!isSupabaseWriteConfigured()) return;
  const dedupeKey = `${entityType}:${entityId}:${operation}:${target}`;
  await mirrorSupabaseUpsert({
    table: 'dual_sync_outbox',
    conflict: 'dedupe_key',
    row: {
      dedupe_key: dedupeKey,
      entity_type: entityType,
      entity_id: entityId,
      operation,
      target,
      payload: jsonSafe(payload),
      status: 'pending',
      attempts: 0,
      updated_at: new Date().toISOString(),
    },
  });
}
