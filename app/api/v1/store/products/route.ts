import { NextResponse } from 'next/server';
import { upsertProduct, validateProductInput } from '@/lib/productSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key.' } },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

function copyToClipboardHint() {
  return {
    'Cache-Control': 'no-store',
  };
}

export async function POST(request: Request) {
  const configuredApiKey = process.env.PRIMEHUB_API_KEY;
  const suppliedApiKey = request.headers.get('x-api-key');

  if (!configuredApiKey || !suppliedApiKey || suppliedApiKey !== configuredApiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const input = validateProductInput(body);
    const result = await upsertProduct(input);
    return NextResponse.json(
      { success: true, ...result },
      { status: result.created ? 201 : 200, headers: copyToClipboardHint() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Product could not be saved.';
    const invalid = /required|cannot be higher/i.test(message);
    console.error('store product sync failed', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: invalid ? 'INVALID_PRODUCT' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: invalid ? 400 : 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
