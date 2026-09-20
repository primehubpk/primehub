import { NextResponse } from 'next/server';
import { verifyPrimeHubAdminRequest } from '@/lib/adminSession';
import { credentialSummary, saveProviderCredentials } from '@/lib/salar/credentialStore';
import { PROVIDER_ORDER, type ProviderName } from '@/lib/salar/providerConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

async function authorized(request: Request) {
  return Boolean(await verifyPrimeHubAdminRequest(request));
}

export async function GET(request: Request) {
  if (!await authorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Admin session expired. Please log in again.' },
      { status: 401, headers },
    );
  }

  try {
    return NextResponse.json(
      { success: true, providers: await credentialSummary() },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Saved API key settings are unavailable.' },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json(
      { success: false, error: 'Invalid request origin.' },
      { status: 403, headers },
    );
  }

  if (!await authorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Admin session expired. Please log in again.' },
      { status: 401, headers },
    );
  }

  if (Number(request.headers.get('content-length') || 0) > 50000) {
    return NextResponse.json({ success: false }, { status: 413, headers });
  }

  try {
    const raw = await request.text();
    if (raw.length > 50000) {
      return NextResponse.json({ success: false }, { status: 413, headers });
    }

    const body = JSON.parse(raw);
    if (body.action !== 'save' || !PROVIDER_ORDER.includes(body.provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider action.' },
        { status: 400, headers },
      );
    }

    await saveProviderCredentials(body.provider as ProviderName, body);
    return NextResponse.json(
      { success: true, providers: await credentialSummary() },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Could not save API key settings. Check the key and account ID format.' },
      { status: 400, headers },
    );
  }
}
