import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

function configuredKey() {
  const key = process.env.IMGBB_API_KEY?.trim();
  if (!key) throw new Error('IMGBB_API_KEY is not configured.');
  return key;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });

    const incoming = await request.formData();
    const image = incoming.get('image');
    if (!(image instanceof File)) return NextResponse.json({ success: false, error: 'An image file is required.' }, { status: 400 });
    if (!image.type.startsWith('image/')) return NextResponse.json({ success: false, error: 'Only image files are allowed.' }, { status: 400 });
    if (image.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, error: 'Image must be 10MB or smaller.' }, { status: 400 });

    const form = new FormData();
    form.append('image', image, image.name || 'upload');
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(configuredKey())}`, { method: 'POST', body: form, cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !result?.data) {
      console.error('ImgBB upload failed', { status: response.status, error: result?.error });
      return NextResponse.json({ success: false, error: 'Image upload failed.' }, { status: 502 });
    }

    const url = typeof result.data.url === 'string' ? result.data.url.trim() : '';
    if (!/^https:\/\/i\.ibb\.co\//i.test(url)) {
      console.error('ImgBB returned a non-CDN URL', { url });
      return NextResponse.json({ success: false, error: 'ImgBB returned an invalid direct CDN image URL.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, url }, { status: 200 });
  } catch (error) {
    console.error('ImgBB upload route error', error);
    return NextResponse.json({ success: false, error: 'Image upload service is unavailable.' }, { status: 500 });
  }
}
