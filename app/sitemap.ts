import type { MetadataRoute } from 'next';
import { getPublicCatalogSnapshot } from '@/lib/publicCatalogServer';
import { slugifyCategory } from '@/lib/categoryUtils';

const SALE_MELA_ROUTE = '/primehubmall/salemela';

const staticRoutes = [
  '/',
  '/shop',
  SALE_MELA_ROUTE,
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

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://primehubmall.com').replace(/\/$/, '');

  const entries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path === '/' || path === '/shop' || path === SALE_MELA_ROUTE || path === '/new-arrivals' || path === '/deals' || path === '/weekly-deals' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : path === '/shop' ? 0.9 : path === SALE_MELA_ROUTE ? 0.8 : 0.6,
  }));

  try {
    const { products, categories } = await getPublicCatalogSnapshot();

    const productEntries: MetadataRoute.Sitemap = products
      .filter((product) => product.active !== false && product.published !== false)
      .map((product) => ({
        url: `${siteUrl}/product/${encodeURIComponent(product.id)}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));

    const seenCategories = new Set<string>();
    const categoryEntries: MetadataRoute.Sitemap = [];
    for (const data of categories) {
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
