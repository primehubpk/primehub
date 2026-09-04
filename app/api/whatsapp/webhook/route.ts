import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Meta calls this endpoint with GET when the WhatsApp webhook is configured.
 * Keep WHATSAPP_VERIFY_TOKEN only in your hosting environment variables.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error('WHATSAPP_VERIFY_TOKEN is not configured');
    return new NextResponse('Webhook is not configured', { status: 500 });
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * Meta sends incoming WhatsApp messages and delivery/status events here.
 * For now we acknowledge events immediately. Bot/reply logic can be attached
 * after the webhook is verified and the production phone number is connected.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    if (payload?.object !== 'whatsapp_business_account') {
      return NextResponse.json({ received: false }, { status: 404 });
    }

    // Do not log message bodies or credentials here. The next integration step
    // will safely extract the required message fields and hand them to the bot.
    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }
}
