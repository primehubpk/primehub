import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCategories, getDualSettings, getDualSkills } from '@/lib/dualReadServer';
import { buildSalaarStoreKnowledge } from '@/lib/salaarStoreKnowledgeCore';

export const SALAAR_STORE_KNOWLEDGE_REVALIDATE_SECONDS = 15 * 60;

async function loadSalaarStoreKnowledge() {
  const [settings, categories, skills] = await Promise.all([
    getDualSettings(),
    getDualCategories(),
    getDualSkills(),
  ]);

  if (settings.source === 'empty' || Object.keys(settings.documents || {}).length === 0) {
    throw new Error('Salaar store knowledge settings unavailable from all configured sources.');
  }

  return buildSalaarStoreKnowledge({
    documents: settings.documents,
    categories: Array.isArray(categories.categories) ? categories.categories : [],
    skills: Array.isArray(skills.skills) ? skills.skills : [],
    sources: {
      settings: settings.source,
      categories: categories.source,
      skills: skills.source,
    },
  });
}

export const getSalaarStoreKnowledgeSnapshot = unstable_cache(
  loadSalaarStoreKnowledge,
  ['primehub-salaar-store-knowledge-v1'],
  {
    revalidate: SALAAR_STORE_KNOWLEDGE_REVALIDATE_SECONDS,
    tags: ['salaar-store-knowledge'],
  },
);

export async function getLiveSalaarStoreKnowledgeSnapshot() {
  return loadSalaarStoreKnowledge();
}
