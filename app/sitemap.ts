import type { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { slugifyCategory } from '@/lib/categoryUtils';

const staticRoutes = [
  '/',
  '/shop',
  '/new-arrivals',
  '/deals',
  '/weekly-deals',
  '/skills',
  '/rewards',
  '/reseller',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/return-policy',
];

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://primehubmall.com').replace(/\/$/, '');

  const entries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path === '/' || path === '/shop' || path === '/new-arrivals' || path === '/deals' || path === '/weekly-deals' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : path === '/shop' ? 0.9 : 0.6,
  }));

  try {
    const db = getAdminDb();
    const [productsSnapshot, categoriesSnapshot] = await Promise.all([
      db.collection('products').get(),
      db.collection('categories').get(),
    ]);

    const productEntries: MetadataRoute.Sitemap = productsSnapshot.docs
      .filter((doc) => doc.data()?.active !== false)
      .map((doc) => ({
        url: `${siteUrl}/product/${encodeURIComponent(doc.id)}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));

    const seenCategories = new Set<string>();
    const categoryEntries: MetadataRoute.Sitemap = [];
    for (const doc of categoriesSnapshot.docs) {
      const data = doc.data() || {};
      if (data.active === false) continue;
      const title = String(data.title || data.name || '').trim();
      const slug = slugifyCategory(title);
      if (!slug || seenCategories.has(slug)) continue;
      seenCategories.add(slug);
      categoryEntries.push({
        url: `${siteUrl}/category/${encodeURIComponent(slug)}`,
        changeFrequency: 'weekly',
        priority: 0.75,
      });
    }

    return [...entries, ...categoryEntries, ...productEntries];
  } catch (error) {
    console.error('Sitemap dynamic entries could not be loaded:', error);
    return entries;
  }
}
