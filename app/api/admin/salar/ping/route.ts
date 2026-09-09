import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { ping, SALAR_SAFE_ERROR_MESSAGE } from '@/lib/salar/keyRotator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  if (!isExistingPrimeHubAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  try {
    return NextResponse.json(await ping(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: SALAR_SAFE_ERROR_MESSAGE }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const GET = handle;
export const POST = handle;
