import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog, getDualProduct, getDualStorefrontSettings, getDualSkills } from '@/lib/dualReadServer';
import { getStorefrontSettingsWithBigDealRecovery } from '@/lib/storefrontSettingsServer';
import { getCachedWholesaleVideosSnapshot } from '@/lib/wholesaleVideosServer';

const CATALOG_RETRY_DELAYS_MS = [0];
const SETTINGS_RETRY_DELAYS_MS = [0];
const PUBLIC_PRIMARY_TIMEOUT_MS = 8000;
// Admin/product writes explicitly invalidate the public-catalog tag, so a longer
// fallback TTL cuts repeated Supabase egress without delaying normal updates.
const CATALOG_READ_CACHE = { revalidate: 600, tags: ['public-catalog'], timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS };
const PRODUCT_READ_CACHE = { revalidate: 300, tags: ['public-products'], timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS };
const SETTINGS_READ_CACHE = { revalidate: 300, tags: ['storefront-settings'], timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS };
const SKILLS_READ_CACHE = { revalidate: 600, tags: ['prime-skills', 'storefront-settings'], timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS };

function supabaseServiceConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '',
  ).trim();
  if (!url || !key) throw new Error('Supabase storefront reward access is not configured.');
  return { url, key };
}

export async function getPublicRewardGiftsSnapshot() {
  const { url, key } = supabaseServiceConfig();
  const params = new URLSearchParams();
  params.set('select', 'id,active,payload');
  params.set('active', 'eq.true');
  params.set('order', 'updated_at.desc');
  params.set('limit', '100');
  const response = await fetch(`${url}/rest/v1/reward_gifts?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 600, tags: ['rewards'] },
    signal: AbortSignal.timeout(PUBLIC_PRIMARY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Supabase reward gifts read failed ${response.status}`);
  const rows = await response.json() as any[];
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...(row?.payload && typeof row.payload === 'object' ? row.payload : {}),
    id: String(row?.id || ''),
    active: row?.payload?.active ?? row?.active ?? true,
  })).filter((gift) => gift.id && gift.active !== false && Number(gift.pointsCost || 0) > 0);
}

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadPublicCatalog() {
  let lastSource = 'empty';

  for (const delay of CATALOG_RETRY_DELAYS_MS) {
    await wait(delay);
    const result = await getDualCatalog(CATALOG_READ_CACHE);
    lastSource = result.source;

    if (result.source !== 'empty' && result.products.length > 0) {
      return {
        products: result.products,
        categories: result.categories,
        source: result.source,
      };
    }
  }

  throw new Error(`Public catalog unavailable after retry (source: ${lastSource}).`);
}

export const getPublicCatalogSnapshot = unstable_cache(
  loadPublicCatalog,
  ['primehub-public-catalog-dual-v8'],
  { revalidate: 600, tags: ['public-catalog'] },
);

const CATALOG_SEED_HEAVY_FIELDS = new Set([
  'description',
  'variantMatrix',
  'variantOptions',
  'variantColors',
  'variantSizes',
  'variants',
  'options',
  'colorImages',
]);

/**
 * Catalog pages only need card/search metadata. Full descriptions and variant
 * matrices are fetched from the single-product endpoint when a customer opens
 * or adds an item, so serializing them into every catalog response wastes more
 * than a megabyte on the current catalog (and roughly twice that in RSC HTML).
 */
export function compactPublicCatalogSnapshot<
  T extends { products?: any[]; categories?: any[]; [key: string]: any },
>(snapshot: T): T {
  const products = Array.isArray(snapshot.products)
    ? snapshot.products.map((product) => {
        if (!product || typeof product !== 'object') return product;
        const compact = Object.fromEntries(
          Object.entries(product).filter(([key]) => !CATALOG_SEED_HEAVY_FIELDS.has(key)),
        );
        if (Array.isArray(compact.images) && compact.images.length > 1) {
          compact.images = compact.images.slice(0, 1);
        }
        return compact;
      })
    : [];

  return { ...snapshot, products };
}

export async function getFreshPublicCatalogSnapshot() {
  const result = await getDualCatalog({ cache: 'no-store', timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS });
  if (result.source === 'empty' || result.products.length === 0) {
    throw new Error(`Fresh public catalog unavailable (source: ${result.source}).`);
  }
  return result;
}

async function loadPublicProduct(productId: string) {
  const id = String(productId || '').trim();
  if (!id) return { product: null, source: 'empty' as const };
  return getDualProduct(id, PRODUCT_READ_CACHE);
}

export const getPublicProductSnapshot = unstable_cache(
  loadPublicProduct,
  ['primehub-public-product-dual-v2'],
  { revalidate: 60, tags: ['public-products'] },
);

export async function getFreshPublicProductSnapshot(productId: string) {
  const id = String(productId || '').trim();
  if (!id) return { product: null, source: 'empty' as const };
  return getDualProduct(id, { cache: 'no-store', timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS });
}

async function loadStorefrontSettingsResult() {
  for (const delay of SETTINGS_RETRY_DELAYS_MS) {
    await wait(delay);
    const result = await getStorefrontSettingsWithBigDealRecovery(SETTINGS_READ_CACHE);

    if (result.source !== 'empty' && Object.keys(result.documents).length > 0) {
      return result;
    }
  }

  throw new Error('Storefront settings unavailable after retry.');
}

export const getStorefrontSettingsResultSnapshot = unstable_cache(
  loadStorefrontSettingsResult,
  ['primehub-storefront-settings-dual-v5'],
  { revalidate: 60, tags: ['storefront-settings'] },
);

export async function getStorefrontSettingsSnapshot() {
  const result = await getStorefrontSettingsResultSnapshot();
  const documents = result.documents as Record<string, any>;
  const main = documents.main || {};
  const legacy = documents.general || {};
  return { ...legacy, ...main };
}

export async function getFreshRewardSettingsSnapshot() {
  const result = await getDualStorefrontSettings({ cache: 'no-store' });
  return result.documents?.rewards || {};
}

async function loadRewardSettings() {
  const result = await getDualStorefrontSettings(SETTINGS_READ_CACHE);
  return result.documents?.rewards || {};
}

export const getRewardSettingsSnapshot = unstable_cache(
  loadRewardSettings,
  ['primehub-home-reward-settings-dual-v2'],
  { revalidate: 60, tags: ['storefront-settings', 'rewards'] },
);

async function mergeFreshStorefrontSettings(
  result: Awaited<ReturnType<typeof getStorefrontSettingsWithBigDealRecovery>>,
) {
  const documents = result.documents as Record<string, any>;
  const main = documents.main || {};
  const legacy = documents.general || {};
  const merged = { ...legacy, ...main };

  // Wholesale packages have one authoritative reader. Supabase stays primary and
  // Firebase is consulted only when the primary list is incomplete/unavailable.
  // The wholesale reader also repairs missing fallback items back into Supabase.
  const wholesaleResult = await getCachedWholesaleVideosSnapshot();
  return wholesaleResult.videos.length
    ? { ...merged, wholesaleVideos: wholesaleResult.videos }
    : merged;
}

export async function getFreshStorefrontSettingsDocumentsSnapshot() {
  const result = await getStorefrontSettingsWithBigDealRecovery({ cache: 'no-store' });
  const main = await mergeFreshStorefrontSettings(result);
  return {
    ...(result.documents as Record<string, any>),
    main,
  };
}

export async function getFreshStorefrontSettingsSnapshot() {
  const documents = await getFreshStorefrontSettingsDocumentsSnapshot();
  return documents.main || {};
}

async function loadPrimeSkills() {
  const [skillsResult, settingsResult] = await Promise.all([
    getDualSkills(SKILLS_READ_CACHE),
    getDualStorefrontSettings(SKILLS_READ_CACHE),
  ]);
  const main = settingsResult.documents.main || {};
  return {
    skills: skillsResult.skills,
    skillsPage: main.skillsPage || null,
    source: skillsResult.source,
  };
}

export const getPrimeSkillsSnapshot = unstable_cache(
  loadPrimeSkills,
  ['primehub-prime-skills-dual-v5'],
  { revalidate: 600, tags: ['prime-skills'] },
);
