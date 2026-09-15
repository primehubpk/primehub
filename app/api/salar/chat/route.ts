import { NextResponse } from 'next/server';
import { answerWithSalar, type SalarImageInput } from '@/lib/salar/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function parseJsonField(value: FormDataEntryValue | null, fallback: unknown) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function readRequest(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    const body = await request.json().catch(() => ({}));
    return {
      message: body?.message,
      history: body?.history,
      context: body?.context,
      customerName: body?.customerName,
      image: undefined as SalarImageInput | undefined,
    };
  }

  const form = await request.formData();
  const imageValue = form.get('image');
  let image: SalarImageInput | undefined;

  if (imageValue instanceof File && imageValue.size > 0) {
    if (!imageValue.type.startsWith('image/')) throw new Error('Only image files are supported.');
    if (imageValue.size > MAX_IMAGE_BYTES) throw new Error('Image is too large.');
    image = {
      mimeType: imageValue.type || 'image/jpeg',
      base64: Buffer.from(await imageValue.arrayBuffer()).toString('base64'),
    };
  }

  return {
    message: form.get('message'),
    history: parseJsonField(form.get('history'), []),
    context: parseJsonField(form.get('context'), {}),
    customerName: form.get('customerName'),
    image,
  };
}

export async function POST(request: Request) {
  try {
    const input = await readRequest(request);
    const result = await answerWithSalar(input);
    return NextResponse.json({ success: true, ...result }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Salar chat failed', error);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Please enter a message or attach an image')) {
      return NextResponse.json({ success: false, error: 'Please enter a message or attach an image.' }, { status: 400 });
    }
    if (message.includes('Only image files')) {
      return NextResponse.json({ success: false, error: 'Please attach an image file.' }, { status: 400 });
    }
    if (message.includes('Image is too large')) {
      return NextResponse.json({ success: false, error: 'Image must be 3 MB or smaller.' }, { status: 413 });
    }
    if (message.includes('catalogue is not ready')) {
      return NextResponse.json({ success: false, error: 'Salar is getting ready. Please try again after the catalogue is updated.' }, { status: 503 });
    }
    if (message.includes('No Salar AI provider is configured')) {
      return NextResponse.json({ success: false, error: 'Salar AI providers are not configured in the existing environment.' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Salar could not respond right now. Please try again.' }, { status: 503 });
  }
}
