import type { MetadataRoute } from 'next';

const routes = [
  '/',
  '/shop',
  '/rewards',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/return-policy',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!siteUrl) return [];

  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path === '/' || path === '/shop' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : 0.6,
  }));
}
