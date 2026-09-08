import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog } from '@/lib/dualReadServer';
import { getSalaarStoreKnowledgeSnapshot } from '@/lib/salaarStoreKnowledge';
import { withSalaarEffectivePricing } from '@/lib/salaarDealPricing';
import { readSalaarCatalogBackup, writeSalaarCatalogBackup } from '@/lib/salaarCatalogBackup';

export const SALAAR_CATEGORY_BATCH_SIZE = 30;
export const SALAAR_CATALOG_REVALIDATE_SECONDS = 15 * 60;

type SalaarCatalogSnapshot = {
  products: any[];
  categories: any[];
  source: string;
  refreshedAt: string;
  degraded?: boolean;
};

let lastGoodSnapshot: SalaarCatalogSnapshot | null = null;

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

function remember(snapshot: SalaarCatalogSnapshot) {
  if (!Array.isArray(snapshot.products) || snapshot.products.length === 0) return snapshot;
  lastGoodSnapshot = { ...snapshot, degraded: false };
  void writeSalaarCatalogBackup(lastGoodSnapshot).catch((error) => {
    console.warn('Salaar catalog R2 backup write failed', error);
  });
  return lastGoodSnapshot;
}

async function loadFreshSalaarCatalog(): Promise<SalaarCatalogSnapshot> {
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
  if (result.source === 'empty' || products.length === 0) {
    throw new Error('Salaar catalog unavailable from all configured sources.');
  }

  return remember({
    products,
    categories,
    source: result.source,
    refreshedAt: new Date().toISOString(),
  });
}

const getCachedSalaarCatalog = unstable_cache(
  loadFreshSalaarCatalog,
  ['primehub-salaar-catalog-v6'],
  {
    revalidate: SALAAR_CATALOG_REVALIDATE_SECONDS,
    tags: ['salaar-catalog', 'salaar-store-knowledge'],
  },
);

export async function getSalaarCatalogSnapshot(): Promise<SalaarCatalogSnapshot> {
  try {
    const snapshot = await getCachedSalaarCatalog();
    lastGoodSnapshot = snapshot;
    return snapshot;
  } catch (error) {
    console.warn('Salaar cached catalog refresh failed; trying last-known-good snapshot', error);

    if (lastGoodSnapshot?.products?.length) {
      return {
        ...lastGoodSnapshot,
        source: `memory-last-good:${lastGoodSnapshot.source}`,
        degraded: true,
      };
    }

    const backup = await readSalaarCatalogBackup();
    if (backup?.products?.length) {
      lastGoodSnapshot = { ...backup, degraded: false };
      return {
        ...backup,
        source: `r2-last-good:${backup.source}`,
        degraded: true,
      };
    }

    // Keep the chat route alive for general/help questions. Product truth remains empty,
    // so Salaar can ask a natural clarification instead of inventing catalog facts.
    return {
      products: [],
      categories: [],
      source: 'unavailable',
      refreshedAt: new Date().toISOString(),
      degraded: true,
    };
  }
}

// READY/order confirmation uses this strict uncached path so price, active state and stock
// are checked against a current configured backend. It intentionally never uses stale backup data.
export async function getLiveSalaarCatalogSnapshot() {
  return loadFreshSalaarCatalog();
}
