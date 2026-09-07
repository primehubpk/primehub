import { NextResponse } from 'next/server';
import { compressSalaarImageForR2, isR2PublicUrl, salaarR2ObjectKey, uploadWebpToR2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 1500 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 8;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

type RateEntry = { count: number; resetAt: number };
const uploadRate = new Map<string, RateEntry>();

function cleanSession(value: unknown) {
  const session = typeof value === 'string' ? value.trim().slice(0, 100) : '';
  return /^[a-z0-9][a-z0-9_-]{7,99}$/i.test(session) ? session : '';
}

function clientKey(request: Request, sessionId: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return `${forwarded || realIp || 'unknown'}:${sessionId}`;
}

function consumeRate(key: string) {
  const now = Date.now();
  if (uploadRate.size > 2000) {
    for (const [itemKey, entry] of uploadRate) {
      if (entry.resetAt <= now) uploadRate.delete(itemKey);
    }
  }
  const current = uploadRate.get(key);
  if (!current || current.resetAt <= now) {
    uploadRate.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_UPLOADS_PER_WINDOW) return false;
  current.count += 1;
  uploadRate.set(key, current);
  return true;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const sessionId = cleanSession(form.get('sessionId'));
    const image = form.get('image');

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Valid Salaar session is required.' }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ success: false, error: 'Image file is required.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      return NextResponse.json({ success: false, error: 'JPG, PNG, WEBP or AVIF image required.' }, { status: 415 });
    }
    if (!image.size || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'Image must be 8MB or smaller.' }, { status: 413 });
    }
    if (!consumeRate(clientKey(request, sessionId))) {
      return NextResponse.json({ success: false, error: 'Too many image uploads. Please try again shortly.' }, { status: 429 });
    }

    const compressed = await compressSalaarImageForR2(Buffer.from(await image.arrayBuffer()));
    if (!compressed.length || compressed.length > MAX_STORED_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: 'Image could not be prepared safely.' }, { status: 422 });
    }

    const url = await uploadWebpToR2(compressed, salaarR2ObjectKey(sessionId, image.name || 'customer-image'));
    if (!isR2PublicUrl(url)) {
      return NextResponse.json({ success: false, error: 'Image storage returned an invalid URL.' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      url,
      contentType: 'image/webp',
      originalBytes: image.size,
      storedBytes: compressed.length,
    }, { status: 200 });
  } catch (error) {
    console.error('Salaar customer image upload failed', error);
    return NextResponse.json({ success: false, error: 'Image upload is temporarily unavailable.' }, { status: 500 });
  }
}
