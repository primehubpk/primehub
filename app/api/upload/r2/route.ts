import { NextResponse } from 'next/server';
import { compressForR2, isR2PublicUrl, r2ObjectKey, uploadWebpToR2 } from '@/lib/r2';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const incoming = await request.formData();
    const image = incoming.get('image');
    if (!(image instanceof File)) {
      return NextResponse.json({ success: false, error: 'An image file is required.' }, { status: 400 });
    }
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Only image files are allowed.' }, { status: 400 });
    }
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Image must be 10MB or smaller.' }, { status: 400 });
    }

    const compressed = await compressForR2(Buffer.from(await image.arrayBuffer()));
    const url = await uploadWebpToR2(compressed, r2ObjectKey(image.name || 'upload.webp'));
    if (!isR2PublicUrl(url)) {
      return NextResponse.json({ success: false, error: 'R2 returned an invalid public URL.' }, { status: 502 });
    }
    return NextResponse.json({ success: true, url }, { status: 200 });
  } catch (error) {
    console.error('R2 upload route error', error);
    return NextResponse.json({ success: false, error: 'Image upload service is unavailable.' }, { status: 500 });
  }
}
