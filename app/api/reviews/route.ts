import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isSupabaseWriteConfigured, mapReviewToSupabase, supabasePrimaryUpsert } from '@/lib/dualWriteServer';

export const runtime = 'nodejs';

type ReviewPayload = {
  productId?: string;
  orderId?: string;
  name?: string;
  rating?: number;
  comment?: string;
  imageUrl?: string;
};

function cleanText(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

function reviewDocId(orderId: string, productId: string) {
  return createHash('sha256').update(`${orderId}:${productId}`).digest('hex');
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!url || !key) throw new Error('Supabase review access is not configured.');
  return { url, key };
}

async function supabaseGet(path: string) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Supabase review read failed ${response.status}`);
  return response;
}

async function readSupabaseReviews(productId: string) {
  const params = new URLSearchParams();
  params.set('select', 'id,name,rating,comment,image_url,photos,verified,created_at');
  params.set('product_id', `eq.${productId}`);
  params.set('verified', 'eq.true');
  params.set('order', 'created_at.desc');
  params.set('limit', '100');
  const response = await supabaseGet(`reviews?${params.toString()}`);
  return await response.json() as any[];
}

async function readSupabaseOrder(orderId: string) {
  const params = new URLSearchParams();
  params.set('select', 'id,items,payload');
  params.set('id', `eq.${orderId}`);
  params.set('limit', '1');
  const response = await supabaseGet(`orders?${params.toString()}`);
  const rows = await response.json() as any[];
  if (!rows?.[0]) return null;
  const row = rows[0];
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  return { ...payload, items: Array.isArray(row.items) ? row.items : (Array.isArray(payload.items) ? payload.items : []) };
}

async function supabaseReviewExists(id: string) {
  const params = new URLSearchParams();
  params.set('select', 'id');
  params.set('id', `eq.${id}`);
  params.set('limit', '1');
  const response = await supabaseGet(`reviews?${params.toString()}`);
  const rows = await response.json() as any[];
  return Boolean(rows?.[0]?.id);
}

function publicReview(row: any) {
  return {
    id: String(row?.id || ''),
    name: cleanText(row?.name, 80),
    rating: Math.max(1, Math.min(5, Number(row?.rating || 0))),
    comment: cleanText(row?.comment, 1200),
    imageUrl: cleanText(row?.image_url ?? row?.imageUrl, 1200),
    photos: Array.isArray(row?.photos) ? row.photos.slice(0, 3).map((value: unknown) => cleanText(value, 1200)).filter(Boolean) : [],
    verified: true,
    createdAt: typeof row?.created_at === 'string'
      ? row.created_at
      : row?.createdAt?.toDate?.()?.toISOString?.() || null,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = cleanText(url.searchParams.get('productId'), 160);
    if (!productId) return NextResponse.json({ reviews: [] });

    if (isSupabaseWriteConfigured()) {
      try {
        const rows = await readSupabaseReviews(productId);
        return NextResponse.json(
          { reviews: rows.map(publicReview) },
          { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
        );
      } catch (error) {
        console.warn('Supabase review read failed; Firebase recovery allowed.', error instanceof Error ? error.message : 'unknown');
      }
    }

    const snapshot = await getAdminDb().collection('reviews').where('productId', '==', productId).get();
    const reviews = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as any))
      .filter((review) => review.verified === true)
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
        return bTime - aTime;
      })
      .map(publicReview);

    return NextResponse.json(
      { reviews },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('Review read failed:', error);
    return NextResponse.json({ reviews: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewPayload;
    const productId = cleanText(body.productId, 160);
    const orderId = cleanText(body.orderId, 160);
    const name = cleanText(body.name, 80);
    const comment = cleanText(body.comment, 1200);
    const rating = Math.max(1, Math.min(5, Math.floor(Number(body.rating || 0))));
    const imageUrl = cleanText(body.imageUrl, 1200);

    if (!productId || !orderId || !name || !comment || !Number.isFinite(rating)) {
      return NextResponse.json({ error: 'Please complete your rating and review.' }, { status: 400 });
    }

    const db = getAdminDb();
    let order: any = null;

    if (isSupabaseWriteConfigured()) {
      try {
        order = await readSupabaseOrder(orderId);
      } catch (error) {
        console.warn('Supabase review order verification failed; Firebase recovery allowed.', error instanceof Error ? error.message : 'unknown');
      }
    }

    if (!order) {
      const orderSnapshot = await db.collection('orders').doc(orderId).get();
      if (orderSnapshot.exists) order = orderSnapshot.data() || {};
    }
    if (!order) {
      return NextResponse.json({ error: 'This order could not be verified.' }, { status: 403 });
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const purchased = items.some((item: any) => String(item?.productId || item?.id || '') === productId);
    if (!purchased) {
      return NextResponse.json({ error: 'This product is not part of the verified order.' }, { status: 403 });
    }

    const id = reviewDocId(orderId, productId);
    let exists = false;
    if (isSupabaseWriteConfigured()) {
      try {
        exists = await supabaseReviewExists(id);
      } catch (error) {
        console.warn('Supabase duplicate review check failed; Firebase recovery allowed.', error instanceof Error ? error.message : 'unknown');
      }
    }
    if (!exists) {
      try {
        exists = (await db.collection('reviews').doc(id).get()).exists;
      } catch {
        // Supabase remains authoritative when Firebase quota is unavailable.
      }
    }
    if (exists) {
      return NextResponse.json({ error: 'You already reviewed this product from this order.' }, { status: 409 });
    }

    const reviewData = {
      productId,
      orderId,
      name,
      rating,
      comment,
      imageUrl: imageUrl || null,
      photos: imageUrl ? [imageUrl] : [],
      verified: true,
      source: 'verified_order',
      createdAt: new Date(),
    };

    const supabaseRow = mapReviewToSupabase(id, reviewData);
    if (isSupabaseWriteConfigured()) {
      await supabasePrimaryUpsert({ table: 'reviews', row: supabaseRow });
      try {
        await db.collection('reviews').doc(id).set(reviewData);
      } catch (error) {
        console.warn('Review Firebase mirror skipped after Supabase success.', error instanceof Error ? error.message : 'unknown');
      }
    } else {
      await db.collection('reviews').doc(id).set(reviewData);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Review submit failed:', error);
    return NextResponse.json({ error: 'Unable to submit your review right now.' }, { status: 500 });
  }
}
