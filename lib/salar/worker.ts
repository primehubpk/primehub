import 'server-only';
import { getAdminDb } from '@/lib/firebaseAdmin';

export type SalarWorkerJob = 'catalogue' | 'knowledge';
export type SalarWorkerInput = { job: SalarWorkerJob | string; payload?: Record<string, any>; conversationId?: string | null };

const CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const COMMON_SYNONYMS: Record<string, string[]> = {
  bangles: ['bangle', 'bangles', 'churi', 'churiyan', 'choori', 'chooriyan', 'kangan'],
  bangle: ['bangle', 'bangles', 'churi', 'churiyan', 'choori', 'chooriyan', 'kangan'],
  reseller: ['reseller', 'reseller club'],
  skill: ['skill', 'prime skill', 'skills'],
};

function norm(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function list(value: unknown) { return Array.isArray(value) ? value : []; }
function terms(query: string) {
  const q = norm(query);
  const base = q.split(' ').filter(Boolean);
  const extra = base.flatMap((token) => COMMON_SYNONYMS[token] || []);
  return [...new Set([q, ...base, ...extra.map(norm)].filter(Boolean))];
}
function scoreText(value: unknown, queryTerms: string[]) {
  const hay = norm(value);
  if (!hay) return 0;
  let score = 0;
  for (const term of queryTerms) {
    if (!term) continue;
    if (hay === term) score += 100;
    else if (hay.startsWith(term)) score += 60;
    else if (hay.includes(term)) score += 30;
  }
  return score;
}
function cacheDocId(key: string) { return encodeURIComponent(key).replace(/\./g, '%2E'); }
async function readFreshCache(key: string) {
  const snap = await getAdminDb().collection('salar_cache').doc(cacheDocId(key)).get();
  if (!snap.exists) return null;
  const data: any = snap.data() || {};
  const created = Date.parse(String(data.created_at || ''));
  if (!Number.isFinite(created) || Date.now() - created > CACHE_MAX_AGE_MS) return null;
  return data.value ?? null;
}
async function writeCache(key: string, value: unknown) {
  await getAdminDb().collection('salar_cache').doc(cacheDocId(key)).set({ key, value, created_at: new Date().toISOString() });
}
export async function clearSalarCache() {
  const db = getAdminDb();
  const snap = await db.collection('salar_cache').get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function catalogue(payload: Record<string, any>) {
  const db = getAdminDb();
  const q = String(payload.q || '').trim();
  const requestedId = String(payload.collectionId || '').trim();
  const requestedCollection = String(payload.collection || '').trim();
  const limit = Math.min(100, Math.max(1, Number(payload.limit) || 30));
  const [collectionSnap, productSnap] = await Promise.all([
    db.collection('salar_index_collections').get(),
    db.collection('salar_index_products').get(),
  ]);
  const collections = collectionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
  const products = productSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
  if (!collections.length && !products.length) return { found: false, reason: 'Catalogue index is empty. Run Catalogue Refresh first.' };

  if (!requestedId && !requestedCollection) {
    if (!q) return { found: false, reason: 'Provide q, collection, or collectionId.' };
    const qTerms = terms(q);
    const matchingProductCollectionIds = new Set<string>();
    for (const p of products) {
      const s = Math.max(
        scoreText(p.name, qTerms), scoreText(p.description, qTerms),
        ...list(p.collection_names).map((name) => scoreText(name, qTerms)),
      );
      if (s > 0) list(p.collection_ids).forEach((id) => matchingProductCollectionIds.add(String(id)));
    }
    const directIds = new Set(collections.filter((c) => Math.max(scoreText(c.name, qTerms), scoreText(c.slug, qTerms)) > 0).map((c) => String(c.id)));
    const childIds = new Set(collections.filter((c) => directIds.has(String(c.parent || ''))).map((c) => String(c.id)));
    const matched = collections
      .map((c) => {
        const structural = directIds.has(String(c.id)) ? 80 : childIds.has(String(c.id)) ? 50 : matchingProductCollectionIds.has(String(c.id)) ? 20 : 0;
        const score = Math.max(scoreText(c.name, qTerms), scoreText(c.slug, qTerms), structural);
        const productCount = products.filter((p) => list(p.collection_ids).map(String).includes(String(c.id)) || list(p.collection_names).some((name) => norm(name) === norm(c.name))).length;
        return { id: String(c.id), name: String(c.name || c.slug || c.id), productCount, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    if (!matched.length) return { found: false, reason: `No indexed collections matched "${q}".` };
    return { type: 'collections', query: q, collections: matched.map(({ score, ...item }) => item) };
  }

  let collection: any = null;
  if (requestedId) collection = collections.find((c) => String(c.id) === requestedId || String(c.source_id || '') === requestedId) || null;
  if (!collection && requestedCollection) {
    const wanted = norm(requestedCollection);
    collection = collections.find((c) => norm(c.name) === wanted || norm(c.slug) === wanted) || [...collections].sort((a,b)=>scoreText(b.name,[wanted])-scoreText(a.name,[wanted])).find((c)=>scoreText(c.name,[wanted])>0) || null;
  }
  if (!collection) return { found: false, reason: 'Requested collection was not found in the index.' };

  const key = `cat:${String(collection.id)}|${norm(q)}|${limit}`;
  const cached = await readFreshCache(key);
  if (cached) return { ...cached, cached: true };
  const rows = products.filter((p) => list(p.collection_ids).map(String).includes(String(collection.id)) || list(p.collection_names).some((name) => norm(name) === norm(collection.name))).slice(0, limit);
  if (!rows.length) return { found: false, reason: `Collection "${collection.name}" has no indexed products.` };
  const value = {
    type: 'products', query: q, collection: { id: String(collection.id), name: String(collection.name) },
    products: rows.map((p) => ({
      id: String(p.source_id || p.id), name: String(p.name || p.id), price: Number(p.price) || 0,
      image_url: list(p.image_urls)[0] || null, size: list(p.sizes).join(', ') || null,
      material: p.material ? String(p.material) : null, url: String(p.product_url || `/product/${encodeURIComponent(String(p.source_id || p.id))}`),
    })),
    cached: false,
  };
  await writeCache(key, value);
  return value;
}

const TOPIC_ALIASES: Record<string, string[]> = {
  reseller_club: ['reseller_club', 'reseller club', 'reseller'],
  prime_skill: ['prime_skill', 'prime skill', 'skills'], shopping: ['shopping', 'shop'],
  delivery: ['delivery'], payment: ['payment', 'payment_info', 'checkout'], about: ['about'], contact: ['contact', 'contact_settings'],
};
async function knowledge(payload: Record<string, any>) {
  const topic = String(payload.topic || '').trim();
  if (!topic) return { found: false, reason: 'Provide a knowledge topic.' };
  const key = `know:${norm(topic)}`;
  const cached = await readFreshCache(key);
  if (cached) return { ...cached, cached: true };
  const snap = await getAdminDb().collection('salar_index_pages').get();
  const pages = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
  if (!pages.length) return { found: false, reason: 'Knowledge index is empty. Run Catalogue Refresh first.' };
  const aliases = TOPIC_ALIASES[norm(topic).replace(/ /g, '_')] || [topic];
  const qTerms = [...new Set(aliases.flatMap(terms))];
  const ranked = pages.map((p) => ({ p, score: Math.max(scoreText(p.key, qTerms) * 2, scoreText(p.title, qTerms) * 2, scoreText(p.text_excerpt, qTerms)) })).filter((x) => x.score > 0).sort((a,b)=>b.score-a.score);
  if (!ranked.length) return { found: false, reason: `No indexed page matched "${topic}".` };
  const best = ranked[0].p;
  const value = { title: String(best.title || best.key || topic), url: String(best.url || ''), text: String(best.text_excerpt || ''), cached: false };
  await writeCache(key, value);
  return value;
}

export async function runWorker({ job, payload = {}, conversationId = null }: SalarWorkerInput) {
  let result: any;
  switch (job) {
    case 'catalogue': result = await catalogue(payload); break;
    case 'knowledge': result = await knowledge(payload); break;
    default: result = { found: false, reason: `Unsupported worker job: ${String(job || '')}` };
  }
  console.info('[salar-worker]', { job, conversationId: conversationId || null, type: result?.type || null, found: result?.found !== false, cached: result?.cached === true });
  return result;
}
