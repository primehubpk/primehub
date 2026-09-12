import { revalidateTag } from 'next/cache';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  findSupabaseProductBySlug,
  mapDocumentToSupabase,
  recordMirrorFailure,
  supabasePrimaryUpsert,
} from '@/lib/dualWriteServer';

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
  isWholesale?: boolean;
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
    isWholesale: input.isWholesale === true,
  };
}

function refreshProductCaches() {
  revalidateTag('public-catalog');
  revalidateTag('public-products');
  revalidateTag('salaar-catalog');
  revalidateTag('salaar-store-knowledge');
}

async function legacyFirebaseProductBySlug(slug: string) {
  const snapshot = await getAdminDb().collection('products').where('slug', '==', slug).limit(1).get();
  if (snapshot.empty) return null;
  return {
    id: snapshot.docs[0].id,
    payload: snapshot.docs[0].data() || {},
  };
}

async function mirrorProductToFirebase(productId: string, data: Record<string, any>) {
  try {
    await getAdminDb().collection('products').doc(productId).set(data, { merge: false });
  } catch (error) {
    console.error(`Bot product ${productId} Firebase mirror failed`, error);
    await recordMirrorFailure('products', productId, 'upsert', data, 'firebase');
  }
}

export async function upsertProduct(input: ProductSyncInput): Promise<ProductSyncResult> {
  const db = getAdminDb();
  const slug = input.slug || slugify(input.title);
  const now = new Date().toISOString();

  let existing = await findSupabaseProductBySlug(slug);
  if (!existing) {
    existing = await legacyFirebaseProductBySlug(slug);
  }

  const created = !existing;
  const productId = existing?.id || db.collection('products').doc().id;
  const existingPayload = existing?.payload || {};

  const payload = {
    ...existingPayload,
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
    isWholesale: input.isWholesale === true,
    createdAt: existingPayload.createdAt || now,
    updatedAt: now,
  };

  const row = mapDocumentToSupabase('products', productId, payload, 'supabase');
  if (!row) throw new Error('Product could not be mapped for Supabase.');

  // Supabase is the source of truth. If this write fails, the bot request fails and
  // Firebase is left untouched so the two stores cannot disagree about a "success".
  await supabasePrimaryUpsert({ table: 'products', row });

  // Firebase remains the secondary mirror for legacy/admin compatibility.
  await mirrorProductToFirebase(productId, payload);
  refreshProductCaches();

  return { id: productId, slug, created };
}
