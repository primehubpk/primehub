import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog, getDualSettings, getDualSkills } from '@/lib/dualReadServer';

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
      return { products: result.products, categories: result.categories };
    }
  }

  throw new Error(`Public catalog unavailable after retry (source: ${lastSource}).`);
}

export const getPublicCatalogSnapshot = unstable_cache(
  loadPublicCatalog,
  ['primehub-public-catalog-dual-v2'],
  { revalidate: 3600, tags: ['public-catalog'] },
);

async function loadStorefrontSettings() {
  for (const delay of RETRY_DELAYS_MS) {
    await wait(delay);
    const result = await getDualSettings();

    // Do not cache DEFAULT/blank settings caused by a transient backend failure.
    if (result.source !== 'empty' && Object.keys(result.documents).length > 0) {
      const main = result.documents.main || {};
      const legacy = result.documents.general || {};
      return { ...legacy, ...main };
    }
  }

  throw new Error('Storefront settings unavailable after retry.');
}

export const getStorefrontSettingsSnapshot = unstable_cache(
  loadStorefrontSettings,
  ['primehub-storefront-settings-dual-v2'],
  { revalidate: 300, tags: ['storefront-settings'] },
);

async function loadPrimeSkills() {
  const [skillsResult, settingsResult] = await Promise.all([getDualSkills(), getDualSettings()]);
  const main = settingsResult.documents.main || {};
  return {
    skills: skillsResult.skills,
    skillsPage: main.skillsPage || null,
  };
}

export const getPrimeSkillsSnapshot = unstable_cache(
  loadPrimeSkills,
  ['primehub-prime-skills-dual-v1'],
  { revalidate: 600, tags: ['prime-skills'] },
);
