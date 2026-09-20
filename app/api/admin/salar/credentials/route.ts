import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { PRIMEHUB_ADMIN_EMAIL, PRIMEHUB_ADMIN_UID, PRIMEHUB_ADMIN_SESSION_COOKIE, PRIMEHUB_ADMIN_SESSION_MAX_AGE, adminSessionCookieOptions, verifyPrimeHubAdminRequest } from '@/lib/adminSession';
import { credentialSummary, saveProviderCredentials } from '@/lib/salar/credentialStore';
import { PROVIDER_ORDER, type ProviderName } from '@/lib/salar/providerConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  if (!await verifyPrimeHubAdminRequest(request)) return NextResponse.json({ success: false, error: 'Verify your admin Google account to manage API keys.' }, { status: 401, headers });
  try { return NextResponse.json({ success: true, providers: await credentialSummary() }, { headers }); }
  catch { return NextResponse.json({ success: false, error: 'Saved key settings are unavailable.' }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ success: false, error: 'Invalid request origin.' }, { status: 403, headers });
  if (Number(request.headers.get('content-length') || 0) > 50000) return NextResponse.json({ success: false }, { status: 413, headers });
  try {
    const raw = await request.text();
    if (raw.length > 50000) return NextResponse.json({ success: false }, { status: 413, headers });
    const body = JSON.parse(raw);
    if (body.action === 'verify-admin') {
      const token = typeof body.idToken === 'string' ? body.idToken : '';
      const auth = getAdminAuth();
      const claims = await auth.verifyIdToken(token, true);
      if (claims.uid !== PRIMEHUB_ADMIN_UID || claims.email !== PRIMEHUB_ADMIN_EMAIL || claims.admin !== true || claims.email_verified !== true || Date.now() / 1000 - claims.auth_time > 300) {
        return NextResponse.json({ success: false, error: 'Sign in again using the authorized admin Google account.' }, { status: 403, headers });
      }
      const session = await auth.createSessionCookie(token, { expiresIn: PRIMEHUB_ADMIN_SESSION_MAX_AGE * 1000 });
      const response = NextResponse.json({ success: true }, { headers });
      response.cookies.set(PRIMEHUB_ADMIN_SESSION_COOKIE, session, adminSessionCookieOptions());
      // Compatibility for existing admin screens; secret routes only trust the verified session.
      response.cookies.set('primehub_admin_auth', 'true', adminSessionCookieOptions());
      return response;
    }
    if (!await verifyPrimeHubAdminRequest(request)) return NextResponse.json({ success: false, error: 'Admin Google verification required.' }, { status: 401, headers });
    if (body.action !== 'save' || !PROVIDER_ORDER.includes(body.provider)) return NextResponse.json({ success: false, error: 'Invalid provider action.' }, { status: 400, headers });
    await saveProviderCredentials(body.provider as ProviderName, body);
    return NextResponse.json({ success: true, providers: await credentialSummary() }, { headers });
  } catch {
    // Never log request bodies, tokens, provider keys, or SDK exception details.
    return NextResponse.json({ success: false, error: 'Could not save or verify. Check admin sign-in, account ID and key format.' }, { status: 400, headers });
  }
}
