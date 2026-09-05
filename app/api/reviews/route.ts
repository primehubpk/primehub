import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = cleanText(url.searchParams.get('productId'), 160);
    if (!productId) return NextResponse.json({ reviews: [] });

    const snapshot = await getAdminDb().collection('reviews').where('productId', '==', productId).get();
    const reviews = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as any))
      .filter((review) => review.verified === true)
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds * 1000 ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds * 1000 ?? 0;
        return bTime - aTime;
      })
      .map((review) => ({
        id: review.id,
        name: cleanText(review.name, 80),
        rating: Math.max(1, Math.min(5, Number(review.rating || 0))),
        comment: cleanText(review.comment, 1200),
        imageUrl: cleanText(review.imageUrl, 1200),
        photos: Array.isArray(review.photos) ? review.photos.slice(0, 3).map((value: unknown) => cleanText(value, 1200)).filter(Boolean) : [],
        verified: true,
        createdAt: review.createdAt?.toDate?.()?.toISOString?.() || null,
      }));

    return NextResponse.json({ reviews });
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
    const orderSnapshot = await db.collection('orders').doc(orderId).get();
    if (!orderSnapshot.exists) {
      return NextResponse.json({ error: 'This order could not be verified.' }, { status: 403 });
    }

    const order = orderSnapshot.data() || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const purchased = items.some((item: any) => String(item?.productId || item?.id || '') === productId);
    if (!purchased) {
      return NextResponse.json({ error: 'This product is not part of the verified order.' }, { status: 403 });
    }

    const ref = db.collection('reviews').doc(reviewDocId(orderId, productId));
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json({ error: 'You already reviewed this product from this order.' }, { status: 409 });
    }

    await ref.set({
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
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Review submit failed:', error);
    return NextResponse.json({ error: 'Unable to submit your review right now.' }, { status: 500 });
  }
}
