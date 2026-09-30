import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { postingAdmin, sameOrigin, signOAuthState } from '@/lib/integrations/tiktokPostingAuth';
import { tiktokConfig } from '@/lib/integrations/tiktokPosting';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request) || !await postingAdmin(request)) return NextResponse.json({ error: 'TikTok admin authorization required.' }, { status: 403 });
  try {
    const { clientKey, redirectUri } = tiktokConfig();
    const state = signOAuthState(randomBytes(24).toString('base64url'));
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    for (const [key, value] of Object.entries({
      client_key: clientKey, response_type: 'code', scope: 'user.info.basic,video.publish', redirect_uri: redirectUri, state,
    })) url.searchParams.set(key, value);
    const response = NextResponse.json({ url: url.toString() });
    response.cookies.set('primehub_tiktok_oauth_state', state, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/api/tiktok/oauth', maxAge: 600,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TikTok connection failed.' }, { status: 503 });
  }
}
