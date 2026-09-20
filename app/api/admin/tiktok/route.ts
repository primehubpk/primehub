import { NextResponse } from 'next/server';
import { verifyPrimeHubAdminRequest } from '@/lib/adminSession';
import { getTikTokEventsSummary, saveTikTokEventsSettings } from '@/lib/integrations/tiktokStore';
import { sendTikTokServerEvent } from '@/lib/tiktokEventsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

async function authorized(request: Request) {
  return Boolean(await verifyPrimeHubAdminRequest(request));
}

export async function GET(request: Request) {
  if (!await authorized(request)) {
    return NextResponse.json({ success: false, error: 'Admin session expired.' }, { status: 401, headers });
  }

  try {
    return NextResponse.json({ success: true, settings: await getTikTokEventsSummary() }, { headers });
  } catch {
    return NextResponse.json({ success: false, error: 'TikTok Events API settings could not load.' }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, error: 'Invalid request origin.' }, { status: 403, headers });
  }
  if (!await authorized(request)) {
    return NextResponse.json({ success: false, error: 'Admin session expired.' }, { status: 401, headers });
  }

  try {
    const body = await request.json().catch(() => ({}));

    if (body?.action === 'save') {
      await saveTikTokEventsSettings(body);
      return NextResponse.json({ success: true, settings: await getTikTokEventsSummary() }, { headers });
    }

    if (body?.action === 'test') {
      const testCode = String(body?.testEventCode || '').trim();
      if (!testCode) {
        return NextResponse.json({ success: false, error: 'Paste the Test Event Code from TikTok first.' }, { status: 400, headers });
      }
      const result = await sendTikTokServerEvent(request, {
        event: 'ViewContent',
        eventId: `primehub_test_${Date.now()}`,
        payload: { currency: 'PKR' },
        pageUrl: new URL(request.url).origin,
        forceTestCode: testCode,
      });
      return NextResponse.json({ success: true, test: result }, { headers });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400, headers });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'TikTok settings request failed.',
    }, { status: 400, headers });
  }
}
