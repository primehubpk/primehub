import 'server-only';
import products from '@/data/bogo-staged-products.json';

// Staged inventory is visible on the owner's local DEVELOPMENT preview only.
// Real Vercel preview and production must read the approved Supabase Admin
// catalogue instead: no synthetic checkout rows or shadowing a live product.
export function stagedBogoProducts(): any[] {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL && !process.env.VERCEL_ENV
    ? products : [];
}
export function withStagedBogoCatalog<T extends { products: any[] }>(catalog: T): T {
  const existing = new Set(catalog.products.map(product => String(product.id)));
  return { ...catalog, products: [...catalog.products, ...stagedBogoProducts().filter(product => !existing.has(product.id))] };
}
