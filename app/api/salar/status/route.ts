import { NextResponse } from 'next/server';
import { getSalarState } from '@/lib/salar/server';
import { getSalarUiSettings } from '@/lib/salar/uiSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [state, ui] = await Promise.all([
      getSalarState(),
      getSalarUiSettings(),
    ]);

    return NextResponse.json(
      {
        success: true,
        settings: {
          enabled: state.enabled,
          iconUrl: ui.iconUrl,
        },
      },
      {
        headers: {
          // This endpoint contains only public widget state. It may be shared at
          // the CDN; private chat history never passes through this response.
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('Salar public status read failed', error);
    return NextResponse.json(
      { success: false, error: 'Salar status could not load.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
