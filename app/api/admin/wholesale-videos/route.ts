import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import {
  getWholesaleVideosSnapshot,
  saveWholesaleVideosSupabasePrimary,
} from '@/lib/wholesaleVideosServer';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const result = await getWholesaleVideosSnapshot();
    return NextResponse.json({ success: true, ...result }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' },
    });
  } catch (error) {
    console.error('Wholesale package admin read failed', error);
    return NextResponse.json({ error: 'Wholesale packages unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await saveWholesaleVideosSupabasePrimary(body?.videos);
    revalidateTag('storefront-settings');
    revalidateTag('salaar-store-knowledge');
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Wholesale package admin save failed', error);
    return NextResponse.json({ error: 'Wholesale packages save failed.' }, { status: 500 });
  }
}
