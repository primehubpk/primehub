import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog, getDualProduct, getDualSettings, getDualSkills } from '@/lib/dualReadServer';
import { getStorefrontSettingsWithBigDealRecovery } from '@/lib/storefrontSettingsServer';
import { getWholesaleVideosSnapshot } from '@/lib/wholesaleVideosServer';

const CATALOG_RETRY_DELAYS_MS = [0];
const SETTINGS_RETRY_DELAYS_MS = [0];
const PUBLIC_PRIMARY_TIMEOUT_MS = 1800;
const CATALOG_READ_CACHE = { revalidate: 3600, tags: ['public-catalog'], timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS };
const PRODUCT_READ_CACHE = { revalidate: 60, tags: ['public-products'], timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS };
const SETTINGS_READ_CACHE = { revalidate: 60, tags: ['storefront-settings'], timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS };
const SKILLS_READ_CACHE = { revalidate: 600, tags: ['prime-skills', 'storefront-settings'], timeoutMs: PUBLIC_PRIMARY_TIMEOUT_MS };

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
  ['primehub-public-catalog-dual-v6'],
  { revalidate: 3600, tags: ['public-catalog'] },
);

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
  const result = await getDualSettings({ cache: 'no-store' });
  return result.documents?.rewards || {};
}

async function loadRewardSettings() {
  const result = await getDualSettings(SETTINGS_READ_CACHE);
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
  const wholesaleResult = await getWholesaleVideosSnapshot();
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
    getDualSettings(SKILLS_READ_CACHE),
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
