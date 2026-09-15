import { NextResponse } from 'next/server';
import { getSalarState } from '@/lib/salar/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function safeHttpsUrl(value: unknown) {
  const raw = String(value || '').trim().slice(0, 1800);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function catalogueImageUrls(product: any) {
  const values = [
    ...(Array.isArray(product?.images) ? product.images.slice(0, 12) : []),
    ...(Array.isArray(product?.variantColors) ? product.variantColors.slice(0, 30).map((variant: any) => variant?.imageUrl) : []),
    product?.imageUrl,
    product?.image,
  ];
  return values.map((value: any) => safeHttpsUrl(typeof value === 'string' ? value : value?.url || value?.imageUrl || value?.src || value?.image)).filter(Boolean);
}

export async function GET(request: Request) {
  try {
    const requested = safeHttpsUrl(new URL(request.url).searchParams.get('url'));
    if (!requested) return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });

    const state = await getSalarState();
    const allowed = new Set((state.catalogue?.products || []).flatMap((product: any) => catalogueImageUrls(product)));
    if (!allowed.has(requested)) return NextResponse.json({ error: 'Image is not in the live Salar catalogue.' }, { status: 404 });

    const response = await fetch(requested, {
      cache: 'no-store',
      headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'User-Agent': 'PrimeHubMall-Salar/1.0' },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return NextResponse.json({ error: 'Image could not be loaded.' }, { status: 502 });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) return NextResponse.json({ error: 'Remote file is not an image.' }, { status: 415 });
    const declared = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image is too large.' }, { status: 413 });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image is too large.' }, { status: 413 });

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Salar image proxy failed', error);
    return NextResponse.json({ error: 'Image could not be loaded.' }, { status: 503 });
  }
}
