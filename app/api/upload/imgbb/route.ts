import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function configuredKey() {
  const key = process.env.IMGBB_API_KEY;
  if (!key) throw new Error('IMGBB_API_KEY is not configured.');
  return key;
}

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const image = incoming.get('image');
    if (!(image instanceof File)) {
      return NextResponse.json({ success: false, error: 'An image file is required.' }, { status: 400 });
    }

    const form = new FormData();
    form.append('image', image);
    // Intentionally omit ImgBB's expiration parameter: uploaded product media must be permanent.

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(configuredKey())}`, {
      method: 'POST',
      body: form,
      cache: 'no-store',
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !result?.data) {
      console.error('ImgBB upload failed', { status: response.status, error: result?.error });
      return NextResponse.json({ success: false, error: 'Image upload failed.' }, { status: 502 });
    }

    const url = typeof result.data.url === 'string' ? result.data.url : typeof result.data.display_url === 'string' ? result.data.display_url : '';
    if (!url || !/^https:\/\/(?:i\.ibb\.co|ibb\.co)\//i.test(url)) {
      return NextResponse.json({ success: false, error: 'ImgBB returned an invalid image URL.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, url }, { status: 200 });
  } catch (error) {
    console.error('ImgBB upload route error', error);
    return NextResponse.json({ success: false, error: 'Image upload service is unavailable.' }, { status: 500 });
  }
}
