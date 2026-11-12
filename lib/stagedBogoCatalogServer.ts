import 'server-only';
import products from '@/data/bogo-staged-products.json';

// Owner review on the private laptop only. No seed products enter production
// until the reviewed catalogue is explicitly imported through protected Admin.
export function stagedBogoProducts(): any[] {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL && !process.env.VERCEL_ENV
    ? products : [];
}
export function withStagedBogoCatalog<T extends { products: any[] }>(catalog: T): T {
  const existing = new Set(catalog.products.map(product => String(product.id)));
  return { ...catalog, products: [...catalog.products, ...stagedBogoProducts().filter(product => !existing.has(product.id))] };
}
