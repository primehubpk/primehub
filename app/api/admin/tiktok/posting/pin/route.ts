import { NextResponse } from 'next/server';
import { verifyPrimeHubAdminRequest } from '@/lib/adminSession';
import { getPostingPin, savePostingPin } from '@/lib/integrations/tiktokPosting';
import { postingAdmin, sameOrigin } from '@/lib/integrations/tiktokPostingAuth';
import { createPostingSession, POSTING_SESSION_COOKIE, postingSessionCookieOptions } from '@/lib/integrations/tiktokPostingSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  if (!await verifyPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Admin session expired.' }, { status: 401, headers });
  try {
    return NextResponse.json({ configured: Boolean(await getPostingPin()), authorized: await postingAdmin(request) }, { headers });
  } catch {
    return NextResponse.json({ error: 'TikTok PIN settings could not load.' }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  if (!await verifyPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Admin session expired.' }, { status: 401, headers });
  try {
    const body = await request.json();
    if (body?.action === 'unlock') {
      if (!await postingAdmin(request)) return NextResponse.json({ error: 'Enter your saved TikTok posting PIN to unlock this browser.' }, { status: 403, headers });
      const pin = await getPostingPin();
      if (!pin) return NextResponse.json({ error: 'Save a TikTok posting PIN first.' }, { status: 404, headers });
      const response = NextResponse.json({ configured: true, authorized: true }, { headers });
      response.cookies.set(POSTING_SESSION_COOKIE, createPostingSession(pin), postingSessionCookieOptions());
      return response;
    }
    if (body?.action === 'reveal') {
      const pin = await getPostingPin();
      if (!pin) return NextResponse.json({ error: 'Save a TikTok posting PIN first.' }, { status: 404, headers });
      return NextResponse.json({ pin }, { headers });
    }
    if (body?.action !== 'save') return NextResponse.json({ error: 'Unknown action.' }, { status: 400, headers });
    if (typeof body.pin !== 'string') return NextResponse.json({ error: 'Enter a TikTok posting PIN.' }, { status: 400, headers });
    await savePostingPin(body.pin);
    const pin = await getPostingPin();
    if (!pin) throw new Error('PIN was not saved.');
    const response = NextResponse.json({ configured: true, authorized: true }, { headers });
    response.cookies.set(POSTING_SESSION_COOKIE, createPostingSession(pin), postingSessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: 'TikTok PIN could not be saved or revealed.' }, { status: 503, headers });
  }
}
