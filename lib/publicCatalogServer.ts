import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog, getDualProduct, getDualSettings, getDualSkills } from '@/lib/dualReadServer';
import { getStorefrontSettingsWithBigDealRecovery } from '@/lib/storefrontSettingsServer';

const RETRY_DELAYS_MS = [0, 250, 750];
const CATALOG_READ_CACHE = { cache: 'force-cache' as const, revalidate: 3600, tags: ['public-catalog'] };
const PRODUCT_READ_CACHE = { cache: 'force-cache' as const, revalidate: 60, tags: ['public-products'] };
const SETTINGS_READ_CACHE = { cache: 'force-cache' as const, revalidate: 60, tags: ['storefront-settings'] };
const SKILLS_READ_CACHE = { cache: 'force-cache' as const, revalidate: 600, tags: ['prime-skills', 'storefront-settings'] };

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadPublicCatalog() {
  let lastSource = 'empty';

  for (const delay of RETRY_DELAYS_MS) {
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
  ['primehub-public-catalog-dual-v4'],
  { revalidate: 3600, tags: ['public-catalog'] },
);

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

async function loadStorefrontSettingsResult() {
  for (const delay of RETRY_DELAYS_MS) {
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
  ['primehub-prime-skills-dual-v3'],
  { revalidate: 600, tags: ['prime-skills'] },
);
