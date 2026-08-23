import { getAdminDb } from '@/lib/firebaseAdmin';

export type ProductSyncInput = {
  title: string;
  slug?: string;
  price: number;
  originalPrice: number;
  description?: string;
  category: string;
  stock?: number;
  videoUrl?: string;
  imageUrl?: string;
  images?: string[];
  colorImages?: Record<string, string>;
  variantColors?: Array<{ name: string; imageUrl?: string }>;
  variantOptions?: Array<{ id: string; name?: string; values: string[] }>;
  variantMatrix?: Array<Record<string, unknown>>;
  featured?: boolean;
  published?: boolean;
  priceBucketIds?: string[];
  isFlashSale?: boolean;
  isWeekendSpecial?: boolean;
};

export type ProductSyncResult = {
  id: string;
  slug: string;
  created: boolean;
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function validateProductInput(body: unknown): ProductSyncInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Product JSON is required.');
  }
  const input = body as Record<string, unknown>;
  const title = String(input.title || '').trim();
  const category = String(input.category || '').trim();
  const originalPrice = asNumber(input.originalPrice ?? input.price);
  const price = asNumber(input.price ?? originalPrice, originalPrice);
  if (!title || !category || !originalPrice) {
    throw new Error('title, originalPrice and category are required.');
  }
  if (price > originalPrice) {
    throw new Error('Discount price cannot be higher than original price.');
  }
  const images = Array.isArray(input.images)
    ? input.images.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : [];
  const imageUrl = String(input.imageUrl || images[0] || '');
  return {
    title,
    slug: String(input.slug || slugify(title)),
    price,
    originalPrice,
    description: String(input.description || ''),
    category,
    stock: Math.max(0, asNumber(input.stock, 30)),
    videoUrl: String(input.videoUrl || '').trim(),
    imageUrl,
    images,
    colorImages: (input.colorImages as Record<string, string>) || {},
    variantColors: Array.isArray(input.variantColors) ? (input.variantColors as ProductSyncInput['variantColors']) : [],
    variantOptions: Array.isArray(input.variantOptions) ? (input.variantOptions as ProductSyncInput['variantOptions']) : [],
    variantMatrix: Array.isArray(input.variantMatrix) ? (input.variantMatrix as ProductSyncInput['variantMatrix']) : [],
    featured: Boolean(input.featured),
    published: input.published !== false,
    priceBucketIds: Array.isArray(input.priceBucketIds)
      ? input.priceBucketIds.map((item) => String(item)).filter(Boolean)
      : [],
    isFlashSale: Boolean(input.isFlashSale),
    isWeekendSpecial: Boolean(input.isWeekendSpecial),
  };
}

export async function upsertProduct(input: ProductSyncInput): Promise<ProductSyncResult> {
  const db = getAdminDb();
  const slug = input.slug || slugify(input.title);
  const now = new Date().toISOString();
  const payload = {
    title: input.title,
    slug,
    price: input.price,
    originalPrice: input.originalPrice,
    description: input.description || '',
    category: input.category,
    stock: input.stock ?? 30,
    videoUrl: input.videoUrl || '',
    imageUrl: input.imageUrl || '',
    images: (input.images || []).slice(0, 6),
    colorImages: input.colorImages || {},
    variantColors: input.variantColors || [],
    variantOptions: input.variantOptions || [],
    variantMatrix: input.variantMatrix || [],
    featured: Boolean(input.featured),
    published: input.published !== false,
    priceBucketIds: input.priceBucketIds || [],
    isFlashSale: Boolean(input.isFlashSale),
    isWeekendSpecial: Boolean(input.isWeekendSpecial),
    updatedAt: now,
  };

  const existing = await db.collection('products').where('slug', '==', slug).limit(1).get();
  if (existing.empty) {
    const ref = await db.collection('products').add({
      ...payload,
      createdAt: now,
    });
    return { id: ref.id, slug, created: true };
  }

  await existing.docs[0].ref.set(payload, { merge: true });
  return { id: existing.docs[0].id, slug, created: false };
}
