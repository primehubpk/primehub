import { NextResponse } from 'next/server';
import { requireActiveResellerForImages, imageAccessError } from '@/lib/resellerImageAccess';
import { getResellerImageGallery, type GalleryImage } from '@/lib/resellerImageGallery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 9 * 1024 * 1024;
async function imageBytes(image: GalleryImage): Promise<Uint8Array> {
  // The URL comes from an internal, allowlisted catalog, never arbitrary request JSON.
  const response = await fetch(image.url, {
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
  });
  if (!response.ok || !response.body || !(response.headers.get('content-type') || '').toLowerCase().startsWith('image/')) {
    throw new Error('Image is unavailable from its original CDN.');
  }
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE_BYTES) { await response.body.cancel(); throw new Error('Image exceeds the 9 MB download limit.'); }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) { await reader.cancel(); throw new Error('Image exceeds the 9 MB download limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!total) throw new Error('Empty image returned from CDN.');
  const result = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.length; }
  return result;
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Origin mismatch.' }, { status: 403 });
  }
  try {
    await requireActiveResellerForImages(request);
    const body = await request.json().catch(() => ({}));
    const category = String(body?.category || '');
    const gallery = await getResellerImageGallery();
    if (!Object.prototype.hasOwnProperty.call(gallery.byCategory, category)) {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }
    const images = gallery.byCategory[category] || [];
    if (body?.mode === 'image') {
      const image = images.find(item => item.id === body?.imageId);
      if (!image) return NextResponse.json({ error: 'Image no longer in category.' }, { status: 404 });
      try {
        const bytes = await imageBytes(image);
        const extension = image.filename.toLowerCase().split('.').pop();
        const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' :
          extension === 'gif' ? 'image/gif' : extension === 'avif' ? 'image/avif' : 'image/jpeg';
        return new Response(bytes, { headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${image.filename}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        } });
      } catch {
        return NextResponse.json({ error: 'Photo cannot be downloaded right now. Please try another image.' }, { status: 502 });
      }
    }
    return NextResponse.json({ error: 'Only original individual image downloads are supported.' }, { status: 400 });
  } catch (error) {
    const { status, message } = imageAccessError(error);
    if (status === 503) console.error('Reseller image download failed:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
