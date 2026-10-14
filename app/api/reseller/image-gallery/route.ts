import { NextResponse } from 'next/server';
import { requireActiveResellerForImages, imageAccessError } from '@/lib/resellerImageAccess';
import { getResellerImageGallery, IMAGE_PAGE_SIZE } from '@/lib/resellerImageGallery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireActiveResellerForImages(request);
    const gallery = await getResellerImageGallery();
    const params = new URL(request.url).searchParams;
    const category = params.get('category') || '';
    const offset = Number(params.get('offset') || 0);
    const all = params.get('all') === '1';
    if (!Number.isSafeInteger(offset) || offset < 0) return NextResponse.json({ error: 'Invalid image page.' }, { status: 400 });
    if (category && !Object.prototype.hasOwnProperty.call(gallery.byCategory, category)) {
      return NextResponse.json({ error: 'Category no longer available.' }, { status: 404 });
    }
    const images = category ? gallery.byCategory[category] || [] : [];
    return NextResponse.json({
      categories: category ? [] : gallery.categories,
      category,
      images: all ? images : images.slice(offset, offset + IMAGE_PAGE_SIZE),
      total: images.length,
      nextOffset: all ? null : offset + IMAGE_PAGE_SIZE < images.length ? offset + IMAGE_PAGE_SIZE : null,
    }, { headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization' } });
  } catch (error) {
    const { status, message } = imageAccessError(error);
    if (status === 503) console.error('Reseller gallery unavailable:', error);
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
