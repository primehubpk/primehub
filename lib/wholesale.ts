import { slugifyCategory } from '@/lib/categoryUtils';

export function isWholesaleProduct(product: {
  isWholesale?: unknown;
  category?: unknown;
  categoryId?: unknown;
}): boolean {
  const flag = product.isWholesale;
  if (flag === true || flag === 1 || flag === 'true' || flag === 'True') return true;

  return [product.category, product.categoryId].some((value) => {
    const raw = String(value || '').trim();
    if (!raw) return false;
    const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return normalized === 'wholesale' || slugifyCategory(raw) === 'wholesale';
  });
}
