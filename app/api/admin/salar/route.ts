import { testSalarProvider } from '@/lib/salar/modelDrivenEngine';
import { NextResponse } from 'next/server';
import { getSalarRuntimeStatus, getSalarState, refreshSalarCatalogue, saveSalarSettings } from '@/lib/salar/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_COOKIE = 'primehub_admin_auth';

function authorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === `${ADMIN_COOKIE}=true`);
}

function adminView(state: Awaited<ReturnType<typeof getSalarState>>) {
  return {
    enabled: state.enabled,
    providerSelection: state.providerSelection,
    instructions: state.instructions,
    orderInstructions: state.orderInstructions,
    updatedAt: state.updatedAt,
    catalogue: state.catalogue ? {
      updatedAt: state.catalogue.updatedAt,
      source: state.catalogue.source,
      productCount: state.catalogue.products.length,
      categoryCount: state.catalogue.categories.length,
      pageCount: state.catalogue.pages.length,
    } : null,
    runtime: getSalarRuntimeStatus(state.providerSelection),
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const state = await getSalarState();
    return NextResponse.json({ success: true, salar: adminView(state) }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Salar admin read failed', error);
    return NextResponse.json({ success: false, error: 'Salar settings could not load.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const state = await saveSalarSettings({
      enabled: body?.enabled,
      providerSelection: body?.providerSelection,
      instructions: body?.instructions,
      orderInstructions: body?.orderInstructions,
    });
    return NextResponse.json({ success: true, salar: adminView(state) });
  } catch (error) {
    console.error('Salar admin save failed', error);
    return NextResponse.json({ success: false, error: 'Salar settings could not be saved.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.action === 'test-provider') {
      const test = await testSalarProvider(body.providerSelection);
      return NextResponse.json({ success: true, test }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (body?.action !== 'refresh-catalogue') {
      return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
    }
    const origin = new URL(request.url).origin;
    const state = await refreshSalarCatalogue(origin);
    return NextResponse.json({ success: true, salar: adminView(state) });
  } catch (error) {
    console.error('Salar catalogue refresh failed', error);
    return NextResponse.json({ success: false, error: 'Catalogue update failed. Live store data could not be cached.' }, { status: 503 });
  }
}

