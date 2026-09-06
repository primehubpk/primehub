import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CASES = {
  hello: 'bhai kasy ho',
  glass: 'glass bangles dekha day',
  skill: 'Prime Skill kya hai?',
  payment: 'samajh nahi aya payment stuck hai',
} as const;

type SmokeCase = keyof typeof CASES;

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const requested = (url.searchParams.get('case') || 'hello') as SmokeCase;
  if (!(requested in CASES)) {
    return NextResponse.json({ error: 'Unknown smoke case' }, { status: 400 });
  }

  const liveUrl = new URL('/api/salaar/live', request.url);
  const response = await fetch(liveUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: `vercel-preview-live-smoke-${requested}-${Date.now()}`,
      message: CASES[requested],
      shownProductIds: [],
    }),
    cache: 'no-store',
  });

  const body = await response.json();
  return NextResponse.json({
    smoke: true,
    path: '/api/salaar/live',
    case: requested,
    upstreamStatus: response.status,
    result: body,
  }, { status: response.ok ? 200 : 502 });
}
