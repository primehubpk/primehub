import { NextResponse } from 'next/server';
import { isExistingPrimeHubAdminRequest } from '@/lib/salar/adminAuth';
import { runWorker } from '@/lib/salar/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isExistingPrimeHubAdminRequest(request)) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const body = await request.json();
    const result = await runWorker({ job: String(body?.job || ''), payload: body?.payload && typeof body.payload === 'object' ? body.payload : {}, conversationId: body?.conversationId ? String(body.conversationId) : null });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ found: false, reason: error instanceof Error ? error.message : 'Worker test failed.' }, { status: 500 });
  }
}
