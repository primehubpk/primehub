import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export async function POST() {
  return NextResponse.json(
    { error: 'New cash withdrawal requests are unavailable. Rewards are for PrimeHub shopping only. If you have a previously earned cash balance or existing request, contact PrimeHub support for settlement under the original terms.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
