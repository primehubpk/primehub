import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPrimeHubAdminRequest } from '@/lib/adminSession';
import { exchangePostingCode, wasPostingConnectedSince } from '@/lib/integrations/tiktokPosting';
import { validOAuthState } from '@/lib/integrations/tiktokPostingAuth';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const destination = new URL('/admin/tiktok', request.url);
  const saved = request.cookies.get('primehub_tiktok_oauth_state')?.value || '';
  const state = request.nextUrl.searchParams.get('state') || '';
  const code = request.nextUrl.searchParams.get('code') || '';
  const finish = () => {
    const result = NextResponse.redirect(destination);
    result.cookies.set('primehub_tiktok_oauth_state', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/tiktok/oauth', maxAge: 0 });
    result.headers.set('Cache-Control', 'no-store');
    return result;
  };
  if (!await verifyPrimeHubAdminRequest(request) || !await validOAuthState(state) || !saved || saved.length !== state.length || !timingSafeEqual(Buffer.from(saved), Buffer.from(state))) {
    destination.searchParams.set('posting', 'Invalid or expired TikTok connection. Please retry.');
    return finish();
  }
  if (!code) {
    destination.searchParams.set('posting', 'TikTok permission was not granted.');
    return finish();
  }
  try {
    await exchangePostingCode(code);
    destination.searchParams.set('posting', 'TikTok sandbox account connected.');
  } catch (error) {
    // TikTok codes are single use. If a parallel callback already saved this
    // connection, the second exchange reports invalid_grant despite success.
    let alreadyConnected = false;
    if (error instanceof Error && error.message === 'TikTok authorization failed: invalid_grant') {
      try { alreadyConnected = await wasPostingConnectedSince(Number(state.split('.')[1])); }
      catch { /* Preserve the original TikTok error if storage is unavailable. */ }
    }
    destination.searchParams.set('posting', alreadyConnected ? 'TikTok sandbox account connected.' : error instanceof Error ? error.message : 'TikTok connection failed.');
  }
  return finish();
}
