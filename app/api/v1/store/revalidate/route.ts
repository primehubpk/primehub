import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key.' } },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const configuredApiKey = process.env.PRIMEHUB_API_KEY;
  const suppliedApiKey = request.headers.get('x-api-key');

  if (!configuredApiKey || !suppliedApiKey || suppliedApiKey !== configuredApiKey) {
    return unauthorized();
  }

  revalidateTag('public-catalog', 'max');
  revalidateTag('public-products', 'max');
  revalidateTag('products', 'max');
  revalidateTag('storefront-settings', 'max');
  revalidateTag('wholesale-videos', 'max');
  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath('/primehubmall/salemela');
  return NextResponse.json({ success: true, revalidated: true });
}
