import { NextResponse } from 'next/server';
import { verifyPrimeHubAdminRequest } from '@/lib/adminSession';
import { getPostingPin, savePostingPin } from '@/lib/integrations/tiktokPosting';
import { sameOrigin } from '@/lib/integrations/tiktokPostingAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  if (!await verifyPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Admin session expired.' }, { status: 401, headers });
  try {
    return NextResponse.json({ configured: Boolean(await getPostingPin()) }, { headers });
  } catch {
    return NextResponse.json({ error: 'TikTok PIN settings could not load.' }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  if (!await verifyPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Admin session expired.' }, { status: 401, headers });
  try {
    const body = await request.json();
    if (body?.action === 'reveal') {
      const pin = await getPostingPin();
      if (!pin) return NextResponse.json({ error: 'Save a TikTok posting PIN first.' }, { status: 404, headers });
      return NextResponse.json({ pin }, { headers });
    }
    if (body?.action !== 'save') return NextResponse.json({ error: 'Unknown action.' }, { status: 400, headers });
    if (typeof body.pin !== 'string') return NextResponse.json({ error: 'Enter a TikTok posting PIN.' }, { status: 400, headers });
    await savePostingPin(body.pin);
    return NextResponse.json({ configured: Boolean(await getPostingPin()) }, { headers });
  } catch {
    return NextResponse.json({ error: 'TikTok PIN could not be saved or revealed.' }, { status: 503, headers });
  }
}
