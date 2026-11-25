// Branch preview only; never manufacture availability or write a live catalog record.
export const BRIDAL_SOURCE_ID = 'ph-new-20261124-bridal-kalire';
export const BRIDAL_DRAFT_ID = 'ph-new-20261124-bridal-kalire-mehroon';
const RED = 'bridal-01-9a2c1345d256.webp';
const MEHROON = 'bridal-02-34a9995668c1.webp';

export function splitBridalPreview<T extends Record<string, any>>(product: T): T[] {
  if (product.id !== BRIDAL_SOURCE_ID || !Array.isArray(product.images)) return [product];
  const red = product.images.find((url: unknown) => typeof url === 'string' && url.endsWith(RED));
  const mehroon = product.images.find((url: unknown) => typeof url === 'string' && url.endsWith(MEHROON));
  if (!red || !mehroon) return [product];
  const redListing = { ...product, imageUrl: red, image: red, images: [red] };
  // Owner confirmed 30 units for Mehroon. The preview listing remains separate
  // from the live database until the reviewed catalog change is published.
  const draft = {
    id: BRIDAL_DRAFT_ID, slug: BRIDAL_DRAFT_ID,
    title: 'Mehroon Bridal Chura Set with Golden Kalire Charms',
    name: 'Mehroon Bridal Chura Set with Golden Kalire Charms',
    category: product.category, categoryId: product.categoryId,
    price: product.price, originalPrice: product.originalPrice,
    imageUrl: mehroon, image: mehroon, images: [mehroon],
    description: 'Mehroon and gold bridal chura with matching decorative hanging kalire charms.',
    createdAt: product.createdAt, created_at: product.created_at,
    active: true, published: true, stock: 30, quantity: 30, hasVariants: false,
    variantMatrix: [], variants: [], variantOptions: [], variantColors: [], variantSizes: [], availableSizes: [],
    previewListingDraft: true,
  };
  return [redListing as T, draft as unknown as T];
}

export function previewBridalCatalog<T extends Record<string, any>>(products: T[], enabled: boolean): T[] {
  if (!enabled || products.some(product => product.id === BRIDAL_DRAFT_ID)) return products;
  return products.flatMap(splitBridalPreview);
}
