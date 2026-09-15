import { NextResponse } from 'next/server';
import { getSalarUiSettings, saveSalarUiSettings } from '@/lib/salar/uiSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  try {
    const ui = await getSalarUiSettings();
    return NextResponse.json({ success: true, ui }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Salar UI settings read failed', error);
    return NextResponse.json({ success: false, error: 'Salar UI settings could not load.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const ui = await saveSalarUiSettings({ iconUrl: body?.iconUrl });
    return NextResponse.json({ success: true, ui }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Salar UI settings save failed', error);
    return NextResponse.json({ success: false, error: 'Salar UI settings could not be saved.' }, { status: 500 });
  }
}
