import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog, getDualProduct, getDualSettings, getDualSkills } from '@/lib/dualReadServer';
import { getStorefrontSettingsWithBigDealRecovery } from '@/lib/storefrontSettingsServer';

const RETRY_DELAYS_MS = [0, 250, 750];

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadPublicCatalog() {
  let lastSource = 'empty';

  for (const delay of RETRY_DELAYS_MS) {
    await wait(delay);
    const result = await getDualCatalog();
    lastSource = result.source;

    // Never put a temporary outage/empty fallback into Next's long-lived data cache.
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
  ['primehub-public-catalog-dual-v3'],
  { revalidate: 3600, tags: ['public-catalog'] },
);

async function loadPublicProduct(productId: string) {
  const id = String(productId || '').trim();
  if (!id) return { product: null, source: 'empty' as const };
  return getDualProduct(id);
}

// Product snapshots are cached on the server only. Customer browsers are told
// not to cache price-bearing API responses, while Admin product writes purge
// this tag immediately so a saved price/stock change cannot be hidden behind
// the performance cache.
export const getPublicProductSnapshot = unstable_cache(
  loadPublicProduct,
  ['primehub-public-product-dual-v1'],
  { revalidate: 60, tags: ['public-products'] },
);

async function loadStorefrontSettingsResult() {
  for (const delay of RETRY_DELAYS_MS) {
    await wait(delay);
    const result = await getStorefrontSettingsWithBigDealRecovery();

    // Do not cache DEFAULT/blank settings caused by a transient backend failure.
    if (result.source !== 'empty' && Object.keys(result.documents).length > 0) {
      return result;
    }
  }

  throw new Error('Storefront settings unavailable after retry.');
}

export const getStorefrontSettingsResultSnapshot = unstable_cache(
  loadStorefrontSettingsResult,
  ['primehub-storefront-settings-dual-v4'],
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
  const [skillsResult, settingsResult] = await Promise.all([getDualSkills(), getDualSettings()]);
  const main = settingsResult.documents.main || {};
  return {
    skills: skillsResult.skills,
    skillsPage: main.skillsPage || null,
    source: skillsResult.source,
  };
}

export const getPrimeSkillsSnapshot = unstable_cache(
  loadPrimeSkills,
  ['primehub-prime-skills-dual-v2'],
  { revalidate: 600, tags: ['prime-skills'] },
);
