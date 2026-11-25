import type { Product } from '@/components/shop/ShopTypes';

// Homepage presentation only. Both photos already belong to the existing
// bridal product: gallery[0] shows red; gallery[1] shows the mehroon view.
// Do not alter catalog records, purchase variants or product-page galleries.
export const BRIDAL_RED_PRODUCT_ID = 'EWJUWzh401XVl1tTezK5';
export const BRIDAL_MEHROON_PRODUCT_ID = 'ph-new-20261124-bridal-kalire';

export function bridalHomepagePreviews(products: Product[], categoryTitle: string): Product[] {
  if (!/^bridal\s+collection$/i.test(categoryTitle.trim())) return products;

  const red = products.find(product => product.id === BRIDAL_RED_PRODUCT_ID);
  const mehroon = products.find(product => product.id === BRIDAL_MEHROON_PRODUCT_ID);
  const separate = products.find(product => product.id === 'ph-new-20261124-bridal-kalire-mehroon');
  if (red && mehroon && separate) return [red, separate, mehroon, ...products.filter(product => ![red.id, separate.id, mehroon.id].includes(product.id))];
  const alternatePhoto = mehroon && Array.isArray(mehroon.images)
    ? mehroon.images[1] : undefined;
  if (!red || !mehroon || typeof alternatePhoto !== 'string' || !alternatePhoto.trim()) {
    return products;
  }

  return [
    red,
    { ...mehroon, imageUrl: alternatePhoto, image: alternatePhoto },
    ...products.filter(product =>
      product.id !== BRIDAL_RED_PRODUCT_ID && product.id !== BRIDAL_MEHROON_PRODUCT_ID),
  ];
}
