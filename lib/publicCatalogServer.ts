import 'server-only';
import { unstable_cache } from 'next/cache';
import { getAdminDb } from '@/lib/firebaseAdmin';

function toSerializable(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(toSerializable);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate().toISOString();
      } catch {
        return null;
      }
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toSerializable(item)]));
  }
  return value;
}

async function loadPublicCatalog() {
  try {
    const db = getAdminDb();
    const [productsSnap, categoriesSnap] = await Promise.all([
      db.collection('products').get(),
      db.collection('categories').get(),
    ]);

    return {
      products: productsSnap.docs.map((doc) => ({ id: doc.id, ...toSerializable(doc.data()) })),
      categories: categoriesSnap.docs.map((doc) => ({ id: doc.id, ...toSerializable(doc.data()) })),
    };
  } catch (error) {
    console.error('public catalog preload failed', error);
    return { products: [], categories: [] };
  }
}

// The catalog can contain hundreds of products, so re-reading the whole
// collection every minute burns Firestore read quota very quickly. The
// homepage already keeps live client listeners after hydration, therefore a
// one-hour server snapshot is enough for fast first paint without repeatedly
// draining quota.
export const getPublicCatalogSnapshot = unstable_cache(
  loadPublicCatalog,
  ['primehub-public-catalog-v2'],
  { revalidate: 3600, tags: ['public-catalog'] },
);

async function loadStorefrontSettings() {
  try {
    const db = getAdminDb();
    const [mainSnap, legacySnap] = await Promise.all([
      db.collection('settings').doc('main').get(),
      db.collection('settings').doc('general').get(),
    ]);
    return {
      ...(legacySnap.exists ? toSerializable(legacySnap.data()) : {}),
      ...(mainSnap.exists ? toSerializable(mainSnap.data()) : {}),
    };
  } catch (error) {
    console.error('storefront settings preload failed', error);
    return {};
  }
}

export const getStorefrontSettingsSnapshot = unstable_cache(
  loadStorefrontSettings,
  ['primehub-storefront-settings-v2'],
  { revalidate: 300, tags: ['storefront-settings'] },
);

async function loadPrimeSkills() {
  try {
    const db = getAdminDb();
    const [skillsSnap, settingsSnap] = await Promise.all([
      db.collection('prime_skills').get(),
      db.collection('settings').doc('main').get(),
    ]);

    return {
      skills: skillsSnap.docs.map((doc) => ({ id: doc.id, ...toSerializable(doc.data()) })),
      skillsPage: settingsSnap.exists ? toSerializable(settingsSnap.data()?.skillsPage || null) : null,
    };
  } catch (error) {
    console.error('prime skills preload failed', error);
    return { skills: [], skillsPage: null };
  }
}

export const getPrimeSkillsSnapshot = unstable_cache(
  loadPrimeSkills,
  ['primehub-prime-skills-v2'],
  { revalidate: 600, tags: ['prime-skills'] },
);
