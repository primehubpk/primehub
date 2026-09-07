import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog } from '@/lib/dualReadServer';
import { getSalaarStoreKnowledgeSnapshot } from '@/lib/salaarStoreKnowledge';
import { withSalaarEffectivePricing } from '@/lib/salaarDealPricing';

export const SALAAR_CATEGORY_BATCH_SIZE = 30;
export const SALAAR_CATALOG_REVALIDATE_SECONDS = 15 * 60;

function serialText(value: unknown, max = 1200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function serialStringArray(value: unknown, max = 30): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, max)
    : [];
}

function compactProduct(product: any) {
  const tags = serialStringArray(product?.tags, 30);
  const images = Array.isArray(product?.images) ? product.images.slice(0, 12) : [];

  return {
    id: String(product?.id ?? ''),
    title: serialText(product?.title || product?.name || product?.productName, 180),
    name: serialText(product?.name || product?.title || product?.productName, 180),
    slug: serialText(product?.slug, 220),
    description: serialText(product?.description, 1000),
    brand: serialText(product?.brand, 140),
    category: serialText(product?.category, 180),
    categoryId: serialText(product?.categoryId, 180),
    subcategory: serialText(product?.subcategory, 180),
    material: serialText(product?.material, 180),
    color: serialText(product?.color, 180),
    tags,
    priceBucketIds: serialStringArray(product?.priceBucketIds, 20),
    price: product?.price,
    salePrice: product?.salePrice,
    retailPrice: product?.retailPrice,
    normalPrice: product?.normalPrice,
    dealPrice: product?.dealPrice,
    dealDay: serialText(product?.dealDay, 40),
    originalPrice: product?.originalPrice,
    compareAtPrice: product?.compareAtPrice,
    stock: product?.stock ?? product?.quantity,
    active: product?.active,
    published: product?.published,
    featured: product?.featured,
    isWholesale: product?.isWholesale,
    isFlashSale: product?.isFlashSale,
    isWeekendSpecial: product?.isWeekendSpecial,
    imageUrl: product?.imageUrl || product?.image || '',
    image: product?.image || product?.imageUrl || '',
    images,
    hasVariants: product?.hasVariants,
    variantColors: product?.variantColors,
    variantSizes: product?.variantSizes,
    colors: product?.colors,
    sizes: product?.sizes,
    variants: product?.variants,
    variantMatrix: product?.variantMatrix,
    colorImages: product?.colorImages,
    createdAt: product?.createdAt || product?.created_at || null,
    updatedAt: product?.updatedAt || product?.updated_at || null,
  };
}

function compactCategory(category: any) {
  return {
    id: String(category?.id ?? ''),
    name: serialText(category?.name, 180),
    slug: serialText(category?.slug, 180),
    active: category?.active,
    sortOrder: category?.sortOrder,
  };
}

async function loadSalaarCatalog() {
  const [result, knowledge] = await Promise.all([
    getDualCatalog(),
    getSalaarStoreKnowledgeSnapshot().catch((error) => {
      console.warn('Salaar deal knowledge unavailable while building catalog snapshot', error);
      return null;
    }),
  ]);
  const products = (Array.isArray(result.products) ? result.products : [])
    .filter((product) => product?.id != null)
    .map(compactProduct)
    .map((product) => withSalaarEffectivePricing(product, knowledge));
  const categories = (Array.isArray(result.categories) ? result.categories : [])
    .filter((category) => category?.id != null)
    .map(compactCategory);

  // A transient dual-backend outage must never become a valid 15-minute cache entry.
  // Throwing keeps "empty because both sources failed" distinct from real catalog data.
  if (result.source === 'empty' || products.length === 0) {
    throw new Error('Salaar catalog unavailable from all configured sources.');
  }

  return {
    products,
    categories,
    source: result.source,
    refreshedAt: new Date().toISOString(),
  };
}

export const getSalaarCatalogSnapshot = unstable_cache(
  loadSalaarCatalog,
  ['primehub-salaar-catalog-v5'],
  {
    revalidate: SALAAR_CATALOG_REVALIDATE_SECONDS,
    tags: ['salaar-catalog', 'salaar-store-knowledge'],
  },
);

// READY/order confirmation uses this uncached path so price, active state and stock
// are checked against the current primary backend (with the configured fallback).
export async function getLiveSalaarCatalogSnapshot() {
  return loadSalaarCatalog();
}
