import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDualCatalog } from '@/lib/dualReadServer';

export const SALAAR_CATEGORY_BATCH_SIZE = 30;
export const SALAAR_CATALOG_REVALIDATE_SECONDS = 15 * 60;

function serialText(value: unknown, max = 1200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function compactProduct(product: any) {
  const tags = Array.isArray(product?.tags)
    ? product.tags.filter((item: unknown) => typeof item === 'string').slice(0, 30)
    : [];
  const images = Array.isArray(product?.images) ? product.images.slice(0, 12) : [];

  return {
    id: String(product?.id ?? ''),
    title: serialText(product?.title || product?.name || product?.productName, 180),
    name: serialText(product?.name || product?.title || product?.productName, 180),
    description: serialText(product?.description, 1000),
    category: serialText(product?.category, 180),
    categoryId: serialText(product?.categoryId, 180),
    subcategory: serialText(product?.subcategory, 180),
    material: serialText(product?.material, 180),
    color: serialText(product?.color, 180),
    tags,
    price: product?.price,
    salePrice: product?.salePrice,
    retailPrice: product?.retailPrice,
    originalPrice: product?.originalPrice,
    compareAtPrice: product?.compareAtPrice,
    stock: product?.stock ?? product?.quantity,
    active: product?.active,
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
  const result = await getDualCatalog();
  return {
    products: (Array.isArray(result.products) ? result.products : [])
      .filter((product) => product?.id != null)
      .map(compactProduct),
    categories: (Array.isArray(result.categories) ? result.categories : [])
      .filter((category) => category?.id != null)
      .map(compactCategory),
    source: result.source,
    refreshedAt: new Date().toISOString(),
  };
}

export const getSalaarCatalogSnapshot = unstable_cache(
  loadSalaarCatalog,
  ['primehub-salaar-catalog-v1'],
  {
    revalidate: SALAAR_CATALOG_REVALIDATE_SECONDS,
    tags: ['salaar-catalog'],
  },
);

// READY/order confirmation uses this uncached path so price, active state and stock
// are checked against the current primary backend (with the configured fallback).
export async function getLiveSalaarCatalogSnapshot() {
  return loadSalaarCatalog();
}
