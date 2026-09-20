import { NextResponse } from 'next/server';
import { sendTikTokServerEvent } from '@/lib/tiktokEventsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ success: false }, { status: 403 });
  }

  if (Number(request.headers.get('content-length') || 0) > 50000) {
    return NextResponse.json({ success: false }, { status: 413 });
  }

  try {
    const raw = await request.text();
    if (raw.length > 50000) return NextResponse.json({ success: false }, { status: 413 });
    const body = JSON.parse(raw);

    const result = await sendTikTokServerEvent(request, {
      event: body?.event,
      eventId: body?.eventId,
      payload: body?.payload,
      pageUrl: body?.pageUrl,
      referrer: body?.referrer,
    });

    return NextResponse.json({ success: true, ...result }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TikTok event could not be sent.';
    return NextResponse.json({ success: false, error: message }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
