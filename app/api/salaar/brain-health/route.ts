import { NextResponse } from 'next/server';
import { getSalaarAiHealthSnapshot } from '@/lib/salaarAiRouter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ai = getSalaarAiHealthSnapshot();
  return NextResponse.json({
    ok: ai.totalAvailableKeys > 0,
    orchestrator: 'salaar',
    routing: {
      deterministicForGroundedSimpleTurns: true,
      aiForAmbiguousOrReasoningTurns: true,
      providerFailover: true,
      providerCooldown: true,
      providerTimeouts: true,
      providerNamesHiddenFromCustomer: true,
    },
    ai,
  }, { status: ai.totalAvailableKeys > 0 ? 200 : 503 });
}
