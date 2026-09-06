import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog, getDualSettings, getDualSkills } from '@/lib/dualReadServer';

async function loadPublicCatalog() {
  const result = await getDualCatalog();
  return { products: result.products, categories: result.categories };
}

export const getPublicCatalogSnapshot = unstable_cache(
  loadPublicCatalog,
  ['primehub-public-catalog-dual-v1'],
  { revalidate: 3600, tags: ['public-catalog'] },
);

async function loadStorefrontSettings() {
  const result = await getDualSettings();
  const main = result.documents.main || {};
  const legacy = result.documents.general || {};
  return { ...legacy, ...main };
}

export const getStorefrontSettingsSnapshot = unstable_cache(
  loadStorefrontSettings,
  ['primehub-storefront-settings-dual-v1'],
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
